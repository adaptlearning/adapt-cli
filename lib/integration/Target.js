import chalk from 'chalk'
import bower from 'bower'
import { exec } from 'child_process'
import semver from 'semver'
import fs from 'fs-extra'
import path from 'path'
import { ADAPT_ALLOW_PRERELEASE } from '../util/constants.js'
import Plugin from './Plugin.js'
/** @typedef {import("./Project.js").default} Project */
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

export default class Target extends Plugin {
  /**
   * @param {Object} options
   * @param {string} options.name
   * @param {string} options.requestedVersion
   * @param {boolean} options.isContrib
   * @param {boolean} options.isCompatibleEnabled whether to target the latest compatible version for all plugin installations (overrides requestedVersion)
   * @param {Project} options.project
   * @param {string} options.cwd
   * @param {Object} options.logger
   */
  constructor ({
    name,
    requestedVersion = '*',
    isContrib = false,
    isCompatibleEnabled = false,
    project,
    cwd = (project?.cwd ?? process.cwd()),
    logger
  } = {}) {
    super({
      name,
      requestedVersion,
      isContrib,
      isCompatibleEnabled,
      project,
      cwd,
      logger
    })
    // The version to be installed
    this.versionToApply = null
    // Keep the project version preupdate
    this.preUpdateProjectVersion = null
    // Was explicitly skipped by the user
    this._isSkipped = null
    // Marks that this target was uninstalled, true, false and null
    this._wasUninstalled = null
  }

  /**
   * Was explicitly skipped by the user
   * @returns {boolean}
   */
  get isSkipped () {
    return Boolean(this._isSkipped)
  }

  get isNoApply () {
    return (this.isPresent && this.versionToApply === null)
  }

  /** @returns {boolean} */
  get hasProposedVersion () {
    return (this.matchedVersion !== null)
  }

  /** @returns {boolean} */
  get isToBeInstalled () {
    return (this.versionToApply !== null && !this._isSkipped)
  }

  /** @returns {boolean} */
  get isInstallSuccessful () {
    return (this.isToBeInstalled && this.isUpToDate)
  }

  /** @returns {boolean} */
  get isInstallFailure () {
    return (this.isToBeInstalled && !this.isUpToDate)
  }

  /** @returns {boolean} */
  get isToBeUninstalled () {
    return (this.versionToApply !== null && !this._isSkipped)
  }

  /** @returns {boolean} */
  get isUninstallSuccessful () {
    return (this.isToBeUninstalled && this._wasUninstalled)
  }

  /** @returns {boolean} */
  get isUninstallFailure () {
    return (this.isToBeUninstalled && !this._wasUninstalled)
  }

  /** @returns {boolean} */
  get isToBeUpdated () {
    return (this.versionToApply !== null && !this._isSkipped)
  }

  /** @returns {boolean} */
  get isUpdateSuccessful () {
    return (this.isToBeUpdated && this.isUpToDate)
  }

  /** @returns {boolean} */
  get isUpdateFailure () {
    return (this.isToBeUpdated && !this.isUpToDate)
  }

  /** @returns {boolean} */
  get isApplyLatestCompatibleVersion () {
    return (this.hasFrameworkCompatibleVersion &&
      semver.satisfies(this.latestCompatibleSourceVersion, this.matchedVersion, semverOptions))
  }

  markSkipped () {
    this._isSkipped = true
  }

  markInstallable () {
    if (!this.isApplyLatestCompatibleVersion && !(this.isLocalSource && this.latestSourceVersion)) return
    this.versionToApply = this.matchedVersion
  }

  markUpdateable () {
    if (!this.isPresent || this.isSkipped || !this.canBeUpdated) return
    if (this.projectVersion === this.matchedVersion) return
    this.versionToApply = this.matchedVersion
  }

  markMasterForInstallation () {
    this.versionToApply = 'master'
  }

  markRequestedForInstallation () {
    this.matchedVersion = this.matchedVersion ?? semver.maxSatisfying(this.sourceVersions, this.requestedVersion, semverOptions)
    if (this.projectVersion === this.matchedVersion) return
    this.versionToApply = this.matchedVersion
  }

  markLatestCompatibleForInstallation () {
    if (this.projectVersion === this.latestCompatibleSourceVersion) return
    this.versionToApply = this.latestCompatibleSourceVersion
  }

  markLatestForInstallation () {
    if (this.projectVersion === this.latestSourceVersion) return
    this.versionToApply = this.latestSourceVersion
  }

  markUninstallable () {
    if (!this.isPresent) return
    this.versionToApply = this.projectVersion
  }

  async install ({ clone = false } = {}) {
    const logger = this.logger
    const pluginTypeFolder = await this.getTypeFolder()
    if (this.isLocalSource) {
      await fs.ensureDir(path.resolve(this.cwd, 'src', pluginTypeFolder))
      const pluginPath = path.resolve(this.cwd, 'src', pluginTypeFolder, this.packageName)
      await fs.rm(pluginPath, { recursive: true, force: true })
      await fs.copy(this.sourcePath, pluginPath, { recursive: true })
      const bowerJSON = await fs.readJSON(path.join(pluginPath, 'bower.json'))
      bowerJSON._source = this.sourcePath
      bowerJSON._wasInstalledFromPath = true
      await fs.writeJSON(path.join(pluginPath, '.bower.json'), bowerJSON, { spaces: 2, replacer: null })
      this._projectInfo = null
      await this.fetchProjectInfo()
      return
    }
    if (clone) {
      // clone install
      const repoDetails = await this.getRepositoryUrl()
      if (!repoDetails) throw new Error('Error: Plugin repository url could not be found.')
      await fs.ensureDir(path.resolve(this.cwd, 'src', pluginTypeFolder))
      const pluginPath = path.resolve(this.cwd, 'src', pluginTypeFolder, this.packageName)
      await fs.rm(pluginPath, { recursive: true, force: true })
      const url = repoDetails.url.replace(/^git:\/\//, 'https://')
      try {
        const exitCode = await new Promise((resolve, reject) => {
          try {
            exec(`git clone ${url} "${pluginPath}"`, resolve)
          } catch (err) {
            reject(err)
          }
        })
        if (exitCode) throw new Error(`The plugin was found but failed to download and install. Exit code ${exitCode}`)
      } catch (error) {
        throw new Error(`The plugin was found but failed to download and install. Error ${error}`)
      }
      if (this.versionToApply !== '*') {
        try {
          await new Promise(resolve => exec(`git -C "${pluginPath}" checkout v${this.versionToApply}`, resolve))
          logger?.log(chalk.green(this.packageName), `is on branch "${this.versionToApply}".`)
        } catch (err) {
          throw new Error(chalk.yellow(this.packageName), `could not checkout branch "${this.versionToApply}".`)
        }
      }
      this._projectInfo = null
      await this.fetchProjectInfo()
      return
    }
    // bower install
    const outputPath = path.join(this.cwd, 'src', pluginTypeFolder)
    const pluginPath = path.join(outputPath, this.packageName)
    try {
      await fs.rm(pluginPath, { recursive: true, force: true })
    } catch (err) {
      throw new Error(`There was a problem writing to the target directory ${pluginPath}`)
    }
    await new Promise((resolve, reject) => {
      const pluginNameVersion = `${this.packageName}@${this.versionToApply}`
      bower.commands.install([pluginNameVersion], null, {
        directory: outputPath,
        cwd: this.cwd,
        registry: this.BOWER_REGISTRY_CONFIG
      })
        .on('end', resolve)
        .on('error', err => {
          err = new Error(`Bower reported ${err}`)
          this._error = err
          reject(err)
        })
    })
    const bowerJSON = await fs.readJSON(path.join(pluginPath, 'bower.json'))
    bowerJSON.version = bowerJSON.version ?? this.versionToApply;
    await fs.writeJSON(path.join(pluginPath, '.bower.json'), bowerJSON, { spaces: 2, replacer: null })
    this._projectInfo = null
    await this.fetchProjectInfo()
  }

  async update () {
    if (!this.isToBeUpdated) throw new Error()
    const typeFolder = await this.getTypeFolder()
    const outputPath = path.join(this.cwd, 'src', typeFolder)
    const pluginPath = path.join(outputPath, this.name)
    try {
      await fs.rm(pluginPath, { recursive: true, force: true })
    } catch (err) {
      throw new Error(`There was a problem writing to the target directory ${pluginPath}`)
    }
    await new Promise((resolve, reject) => {
      const pluginNameVersion = `${this.packageName}@${this.matchedVersion}`
      bower.commands.install([pluginNameVersion], null, {
        directory: outputPath,
        cwd: this.cwd,
        registry: this.BOWER_REGISTRY_CONFIG
      })
        .on('end', resolve)
        .on('error', err => {
          err = new Error(`Bower reported ${err}`)
          this._error = err
          reject(err)
        })
    })
    this.preUpdateProjectVersion = this.projectVersion
    this._projectInfo = null
    await this.fetchProjectInfo()
  }

  async uninstall () {
    try {
      if (!this.isToBeUninstalled) throw new Error()
      await fs.rm(this.projectPath, { recursive: true, force: true })
      this._wasUninstalled = true
    } catch (err) {
      this._wasUninstalled = false
      throw new Error(`There was a problem writing to the target directory ${this.projectPath}`)
    }
  }

  isNameMatch (name) {
    const tester = new RegExp(`${name}$`, 'i')
    return tester.test(this.packageName)
  }

  /**
   * Read plugin data from pluginPath
   * @param {Object} options
   * @param {string} options.pluginPath Path to source directory
   * @param {string} [options.projectPath=process.cwd()] Optional path to potential installation project
   * @returns {Target}
   */
  static async fromPath ({
    pluginPath,
    projectPath = process.cwd()
  }) {
    const target = new Target({
      name: pluginPath,
      cwd: projectPath
    })
    await target.fetchLocalSourceInfo()
    return target
  }
}
