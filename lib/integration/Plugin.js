import slug from 'speakingurl'
import globs from 'globs'
import chalk from 'chalk'
import bower from 'bower'
import { exec } from 'child_process'
import endpointParser from 'bower-endpoint-parser'
import semver from 'semver'
import fs from 'fs-extra'
import path from 'path'
import getBowerRegistryConfig from './getBowerRegistryConfig.js'
import { ADAPT_ALLOW_PRERELEASE } from '../util/constants.js'
import extract from '../util/extract.js'
/** @typedef {import("./Project.js").default} Project */
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

class TYPE {
  constructor ({ pattern, typename, belongsTo }) {
    this.pattern = pattern
    this.typename = typename
    this.belongsTo = belongsTo
  }
}

export const TYPES = [
  new TYPE({
    pattern: /^adapt-component$/,
    typename: 'component',
    belongsTo: 'components'
  }),
  new TYPE({
    pattern: /^adapt-extension$/,
    typename: 'extension',
    belongsTo: 'extensions'
  }),
  new TYPE({
    pattern: /^adapt-menu$/,
    typename: 'menu',
    belongsTo: 'menu'
  }),
  new TYPE({
    pattern: /^adapt-theme$/,
    typename: 'theme',
    belongsTo: 'theme'
  })
]
const defaultType = TYPES[0]

// when a bower command errors this is the maximum number of attempts the command will be repeated
const BOWER_MAX_TRY = 5

// keep plugin instances and clear up and zips extracted during installation
const plugins = []
process.on('beforeExit', () => plugins.forEach(plugin => plugin.deleteExtractedSources()))

export default class Plugin {
  /**
   * @param {object} options
   * @param {string} options.name
   * @param {string} options.requestedVersion
   * @param {Project} options.isContrib
   * @param {boolean} options.isCompatibleEnabled whether to target the latest compatible version for all plugin installations (overrides requestedVersion)
   * @param {Project} options.project
   * @param {Project} options.cwd
   * @param {Project} options.logger
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
    this.logger = logger
    /** @type {Project} */
    this.project = project
    this.cwd = cwd
    this.BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd: this.cwd })
    const endpoint = name + '#' + (isCompatibleEnabled ? '*' : requestedVersion)
    const ep = endpointParser.decompose(endpoint)
    this.sourcePath = null
    this.extractedSource = null
    this.name = ep.name || ep.source
    this.packageName = (/^adapt-/i.test(this.name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(this.name, { maintainCase: true })
    // the constraint given by the user
    this.requestedVersion = requestedVersion
    // a non-wildcard constraint resolved to the highest version of the plugin that satisfies the constraint and is compatible with the framework
    this.proposedVersion = null
    // the version to be installed
    this.versionToApply = null
    // the most recent version of the plugin compatible with the given framework
    this.latestCompatibleSourceVersion = null

    this._isSkipped = null
    this.canBeUpdated = null
    this.preUpdateProjectVersion = null

    // marks that this target was uninstalled, true, false and null
    this._wasUninstalled = null

    const isNameAPath = /\\|\//g.test(this.name)
    const isVersionAPath = /\\|\//g.test(this.requestedVersion)
    const isLocalPath = (isNameAPath || isVersionAPath)
    if (isLocalPath) {
      // wait to name the plugin until the local config file is loaded
      this.sourcePath = isNameAPath ? this.name : this.requestedVersion
      this.extractedSource = null
      this.name = isVersionAPath ? this.packageName : ''
      this.packageName = isNameAPath ? '' : this.packageName
      this.requestedVersion = '*'
    }
    // the path of the source files
    this.projectPath = null
    // the project plugin .bower.json or bower.json
    this._projectInfo = null
    // the result of a query to the server or disk for source files
    this._sourceInfo = null
    // server given versions
    this._versionsInfo = null

    plugins.push(this)
  }

  /**
   * the installed version is the latest version
   * @returns {boolean|null}
   */
  get isUpToDate () {
    return (this.latestSourceVersion && this.projectVersion)
      ? (this.projectVersion === this.latestSourceVersion) || (this.versionToApply === this.proposedVersion)
      : null
  }

  /**
   * the most recent version of the plugin
   * @returns {string|null}
   */
  get latestSourceVersion () {
    return (this._sourceInfo?.version || null)
  }

  /**
   * the installed version of the plugin
   * @returns {string|null}
   */
  get projectVersion () {
    return (this._projectInfo?.version || null)
  }

  /**
   * a list of tags denoting the source versions of the plugin
   * @returns {[string]}
   */
  get sourceVersions () {
    return this._versionsInfo
  }

  /**
   * plugin will be or was installed from a local source
   * @returns {boolean}
   */
  get isLocalSource () {
    return Boolean(this.sourcePath || this?._projectInfo?._wasInstalledFromPath)
  }

  /**
   * plugin will be or was installed from a local source zip
   * @returns {boolean}
   */
  get isLocalSourceZip () {
    return this.isLocalSource && (this.sourcePath?.includes('.zip') || this._projectInfo?._source?.includes('.zip'))
  }

  /**
   * has user requested version
   * @returns {boolean}
   */
  get hasUserRequestVersion () {
    return (this.requestedVersion !== '*')
  }

  /**
   * the supplied a constraint is valid and supported by the plugin
   * @returns {boolean|null}
   */
  get hasValidRequestVersion () {
    return (this.latestSourceVersion)
      ? semver.validRange(this.requestedVersion, semverOptions) &&
        (this.isVersioned
          ? semver.maxSatisfying(this.sourceVersions, this.requestedVersion, semverOptions) !== null
          : semver.satisfies(this.latestSourceVersion, this.requestedVersion)
        )
      : null
  }

  /** @returns {boolean} */
  get hasFrameworkCompatibleVersion () {
    return (this.latestCompatibleSourceVersion !== null)
  }

  /** @returns {boolean} */
  get isVersioned () {
    return Boolean(this.sourceVersions?.length)
  }

  /**
   * is a contrib plugin
   * @returns {boolean}
   */
  get isContrib () {
    return /^adapt-contrib/.test(this.packageName)
  }

  /**
   * whether querying the server or disk for plugin information worked
   * @returns {boolean}
   */
  get isPresent () {
    return (this._projectInfo || this._sourceInfo)
  }

  /**
   * was explicitly skipped by the user
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
    return (this.proposedVersion !== null)
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
      semver.satisfies(this.latestCompatibleSourceVersion, this.proposedVersion, semverOptions))
  }

  async fetchSourceInfo () {
    if (this.isLocalSource) return await this.fetchLocalSourceInfo()
    await this.fetchBowerInfo()
  }

  async fetchLocalSourceInfo () {
    this._sourceInfo = null
    if (!this.isLocalSource) throw new Error('Plugin name or version must be a path to the source')
    if (this.isLocalSourceZip) {
      try {
        this.extractedSource = await extract({
          cwd: this.cwd,
          sourcePath: this.sourcePath
        })
      } catch (err) {
        // QUESTION: Plugin.fetchLocalSourceInfo, from zip, does this need to error properly if zip cannot be extracted?
      }
    }
    this._sourceInfo = await new Promise((resolve, reject) => {
      // get bower.json data
      const paths = [
        path.resolve(this.cwd, `${this.extractedSource?.copyPath || this.sourcePath}/.bower.json`),
        path.resolve(this.cwd, `${this.extractedSource?.copyPath || this.sourcePath}/bower.json`)
      ]
      const bowerJSON = paths.reduce((bowerJSON, bowerJSONPath) => {
        if (bowerJSON) return bowerJSON
        if (!fs.existsSync(bowerJSONPath)) return null
        return fs.readJSONSync(bowerJSONPath)
      }, null)
      resolve(bowerJSON)
    })
    if (!this._sourceInfo) return
    this.name = this._sourceInfo.name
    this.versionToApply = this.latestSourceVersion
    this.packageName = this.name
  }

  async fetchBowerInfo () {
    this._sourceInfo = null
    if (this.isLocalSource) return
    const perform = async (attemptCount = 0) => {
      try {
        return await new Promise((resolve, reject) => {
          bower.commands.info(`${this.packageName}`, null, { cwd: this.cwd, registry: this.BOWER_REGISTRY_CONFIG })
            .on('end', resolve)
            .on('error', reject)
        })
      } catch (err) {
        const isFinished = (err?.code === 'ENOTFOUND' || attemptCount >= BOWER_MAX_TRY)
        if (isFinished) return null
        return await perform(attemptCount++)
      }
    }
    const info = await perform()
    if (!info) return
    this._sourceInfo = info.latest
    this._versionsInfo = info.versions.filter(version => semverOptions.includePrerelease ? true : !semver.prerelease(version))
  }

  async getBowerVersionInfo (version) {
    const perform = async (attemptCount = 0) => {
      try {
        return await new Promise((resolve, reject) => {
          bower.commands.info(`${this.packageName}#${version}`, null, { cwd: this.cwd, registry: this.BOWER_REGISTRY_CONFIG })
            .on('end', resolve)
            .on('error', reject)
        })
      } catch (err) {
        const isFinished = (err?.code === 'ENOTFOUND' || attemptCount >= BOWER_MAX_TRY)
        if (isFinished) return null
        return await perform(attemptCount++)
      }
    }
    return await perform()
  }

  async fetchProjectInfo () {
    this._projectInfo = null
    this._projectInfo = await new Promise((resolve, reject) => {
      // get bower.json data
      globs([
        `${this.cwd.replace(/\\/g, '/')}/src/**/.bower.json`,
        `${this.cwd.replace(/\\/g, '/')}/src/**/bower.json`
      ], (err, matches) => {
        if (err) return resolve(null)
        const tester = new RegExp(`/${this.packageName}/`, 'i')
        const match = matches.find(match => tester.test(match))
        if (!match) return resolve(null)
        this.projectPath = path.resolve(match, '../')
        resolve(fs.readJSONSync(match))
      })
    })
    if (!this._projectInfo) return
    this.name = this._projectInfo.name
    this.packageName = this.name
  }

  /**
   * @returns {TYPE}
   */
  async getType () {
    if (this._type) return this._type
    const keywords = await this.getKeywords()
    const foundTypes = keywords
      .map(keyword => {
        const typematches = TYPES.filter(type => type.pattern.test(keyword))
        return typematches.length
          ? typematches[0]
          : null
      })
      .filter(Boolean)
    return (this._type = (foundTypes.length ? foundTypes[0] : defaultType))
  }

  async getKeywords () {
    if (this._keywords) return this._keywords
    if (this._projectInfo) {
      return (this._keywords = this._projectInfo.keywords)
    }
    if (this.isLocalSource) await this.fetchLocalSourceInfo()
    if (this._sourceInfo) {
      return (this._keywords = this._sourceInfo.keywords)
    }
    return (this._keywords = await new Promise((resolve, reject) => {
      bower.commands.info(this.packageName, 'keywords', { cwd: this.cwd, registry: this.BOWER_REGISTRY_CONFIG })
        .on('end', resolve)
        .on('error', reject)
    }))
  }

  async getRepositoryUrl () {
    if (this._repositoryUrl) return this._repositoryUrl
    if (this.isLocalSource) return
    const url = await new Promise((resolve, reject) => {
      bower.commands.lookup(this.packageName, { cwd: this.cwd, registry: this.BOWER_REGISTRY_CONFIG })
        .on('end', resolve)
        .on('error', reject)
    })
    return (this._repositoryUrl = url)
  }

  async findCompatibleVersion (framework) {
    const getProposedVersion = async () => {
      if (this.isLocalSource) {
        const info = this.projectVersion ? this._projectInfo : this._sourceInfo
        const satisfiesConstraint = !this.hasValidRequestVersion || semver.satisfies(info.version, this.requestedVersion, semverOptions)
        const satisfiesFramework = semver.satisfies(framework, info.framework)
        if (satisfiesFramework && satisfiesConstraint) this.latestCompatibleSourceVersion = info.version
        return info.version
      }

      if (!this.isPresent || !this.isVersioned) {
        return null
      }

      // check if the latest version is compatible
      const satisfiesConstraint = !this.hasValidRequestVersion || semver.satisfies(this._sourceInfo.version, this.requestedVersion, semverOptions)
      const satisfiesFramework = semver.satisfies(framework, this._sourceInfo.framework, semverOptions)
      if (!this.latestCompatibleSourceVersion && satisfiesFramework) this.latestCompatibleSourceVersion = this.latestSourceVersion
      if (satisfiesConstraint && satisfiesFramework) {
        return this.latestSourceVersion
      }
      // find the highest version that is compatible with the framework and constraint
      const checkProposedVersion = async (framework, versionIndex = 0) => {
        const versioninfo = await this.getBowerVersionInfo(this.sourceVersions[versionIndex])
        // give up if there is any failure to obtain version info
        if (!this.isPresent) return null
        // check that the proposed plugin is compatible with the contraint and installed framework
        const satisfiesConstraint = !this.hasValidRequestVersion || semver.satisfies(versioninfo.version, this.requestedVersion, semverOptions)
        const satisfiesFramework = semver.satisfies(framework, versioninfo.framework, semverOptions)
        if (!this.latestCompatibleSourceVersion && satisfiesFramework) this.latestCompatibleSourceVersion = versioninfo.version
        const checkNext = (!satisfiesFramework || !satisfiesConstraint)
        const hasNoMoreVersions = (versionIndex + 1 >= this.sourceVersions.length)
        if (checkNext && hasNoMoreVersions) return null
        if (checkNext) return await checkProposedVersion(framework, versionIndex + 1)
        return versioninfo.version
      }
      return await checkProposedVersion(framework)
    }
    this.proposedVersion = await getProposedVersion()
    if (this.projectVersion && this.proposedVersion) {
      this.canBeUpdated = (this.proposedVersion !== this.projectVersion)
    }
  }

  markSkipped () {
    this._isSkipped = true
  }

  markInstallable () {
    if (!this.isApplyLatestCompatibleVersion) return
    this.versionToApply = this.proposedVersion
  }

  markUpdateable () {
    if (!this.isPresent || this.isSkipped || !this.canBeUpdated) return
    if (this.projectVersion === this.proposedVersion) return
    this.versionToApply = this.proposedVersion
  }

  markRequestedForInstallation () {
    this.proposedVersion = this.proposedVersion ?? semver.maxSatisfying(this.sourceVersions, this.requestedVersion, semverOptions)
    if (this.projectVersion === this.proposedVersion) return
    this.versionToApply = this.proposedVersion
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
    const pluginType = await this.getType()
    if (this.isLocalSource) {
      await fs.ensureDir(path.resolve(this.cwd, 'src', pluginType.belongsTo))
      const pluginPath = path.resolve(this.cwd, 'src', pluginType.belongsTo, this.name)
      await fs.rm(pluginPath, { recursive: true, force: true })
      await fs.copy(this.extractedSource?.copyPath || this.sourcePath, pluginPath, { recursive: true })
      const bowerJSON = await fs.readJSON(path.join(pluginPath, 'bower.json'))
      bowerJSON._source = this.sourcePath
      bowerJSON._wasInstalledFromPath = true
      await fs.writeJSON(path.join(pluginPath, '.bower.json'), bowerJSON, { spaces: 2, replacer: null })
      await this.fetchProjectInfo()
      return
    }
    if (clone) {
      // clone install
      const repoDetails = await this.getRepositoryUrl()
      if (!repoDetails) throw new Error('Error: Plugin repository url could not be found.')
      await fs.ensureDir(path.resolve(this.cwd, 'src', pluginType.belongsTo))
      const pluginPath = path.resolve(this.cwd, 'src', pluginType.belongsTo, this.name)
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
      if (this.requestedVersion !== '*') {
        try {
          await new Promise(resolve => exec(`git checkout -C "${pluginPath}" ${this.versirequestedVersionon}`, resolve))
          logger?.log(chalk.green(this.packageName), `is on branch "${this.requestedVersion}".`)
        } catch (err) {
          throw new Error(chalk.yellow(this.packageName), `could not checkout branch "${this.requestedVersion}".`)
        }
      }
      logger?.log(chalk.green(this.packageName), 'has been installed successfully.')
      await this.fetchProjectInfo()
      return
    }
    // bower install
    const outputPath = path.join(this.cwd, 'src', pluginType.belongsTo)
    const pluginPath = path.join(outputPath, this.name)
    try {
      await fs.rm(pluginPath, { recursive: true, force: true })
    } catch (err) {
      throw new Error(`There was a problem writing to the target directory ${pluginPath}`)
    }
    await new Promise((resolve, reject) => {
      const pluginNameVersion = `${this.packageName}#${this.versionToApply}`
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
    await this.fetchProjectInfo()
  }

  async update () {
    if (!this.isToBeUpdated) throw new Error()
    const type = await this.getType()
    const outputPath = path.join(this.cwd, 'src', type.belongsTo)
    const pluginPath = path.join(outputPath, this.name)
    try {
      await fs.rm(pluginPath, { recursive: true, force: true })
    } catch (err) {
      throw new Error(`There was a problem writing to the target directory ${pluginPath}`)
    }
    await new Promise((resolve, reject) => {
      const pluginNameVersion = `${this.packageName}#${this.proposedVersion}`
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

  /** @returns {string} */
  toString () {
    const isAny = (this.projectVersion === '*')
    return `${this.packageName}${isAny ? '' : `#${this.projectVersion}`}`
  }

  isNameMatch (name) {
    const tester = new RegExp(`${name}$`, 'i')
    return tester.test(this.packageName)
  }

  async getSchemaPaths () {
    if (this.isLocalSource) await this.fetchLocalSourceInfo()
    else if (this.project) await this.fetchProjectInfo()
    else throw new Error(`Cannot fetch schemas from remote plugin: ${this.name}`)
    const pluginPath = this.projectPath ?? this.extractedSource?.copyPath ?? this.sourcePath
    return new Promise((resolve, reject) => {
      return globs(path.resolve(this.cwd, pluginPath, '**/*.schema.json'), (err, matches) => {
        if (err) return reject(err)
        resolve(matches)
      })
    })
  }

  static fromPath ({
    pluginPath,
    projectPath = process.cwd()
  }) {
    return new Plugin({
      name: pluginPath,
      cwd: projectPath
    })
  }

  /**
   * Remove extract zip data
   */
  deleteExtractedSources () {
    if (!this.extractedSource) return
    fs.rmSync(this.extractedSource.rootPath, { recursive: true, force: true })
  }
}
