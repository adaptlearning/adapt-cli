import slug from 'speakingurl'
import globs from 'globs'
import bower from 'bower'
import endpointParser from 'bower-endpoint-parser'
import semver from 'semver'
import fs from 'fs-extra'
import path from 'path'
import getBowerRegistryConfig from './getBowerRegistryConfig.js'
import { ADAPT_ALLOW_PRERELEASE } from '../util/constants.js'
import extract from '../util/extract.js'
import { TYPES, defaultType } from './PluginsTypes.js'
/** @typedef {import("./Project.js").default} Project */
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

// when a bower command errors this is the maximum number of attempts the command will be repeated
const BOWER_MAX_TRY = 5

// keep plugin instances to clear up any zips extracted during installation
process.on('beforeExit', () => Plugin.instances.forEach(plugin => {
  if (!plugin.extractedSource) return
  try {
    fs.rmSync(plugin.extractedSource.rootPath, { recursive: true, force: true })
  } catch (err) {}
}))

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
    // the most recent version of the plugin compatible with the given framework
    this.latestCompatibleSourceVersion = null
    // a non-wildcard constraint resolved to the highest version of the plugin that satisfies the requestedVersion and is compatible with the framework
    this.matchedVersion = null
    // a flag describing if the plugin can be updated
    this.canBeUpdated = null

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

    Plugin.instances.push(this)
  }

  /**
   * the installed version is the latest version
   * @returns {boolean|null}
   */
  get isUpToDate () {
    return (this.latestSourceVersion && this.projectVersion)
      ? (this.projectVersion === this.latestSourceVersion) || (this.latestSourceVersion === this.matchedVersion)
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

  async fetchSourceInfo () {
    if (this.isLocalSource) return await this.fetchLocalSourceInfo()
    await this.fetchBowerInfo()
  }

  async fetchLocalSourceInfo () {
    if (this._sourceInfo) return this._sourceInfo
    this._sourceInfo = null
    if (!this.isLocalSource) throw new Error('Plugin name or version must be a path to the source')
    if (this.isLocalSourceZip) {
      try {
        this.extractedSource = await extract({
          cwd: this.cwd,
          sourcePath: this.sourcePath
        })
      } catch (err) {
        // TODO: Plugin.fetchLocalSourceInfo, from zip, this needs to error properly if zip cannot be extracted
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
    this.matchedVersion = this.latestSourceVersion
    this.packageName = this.name
  }

  async fetchBowerInfo () {
    if (this._sourceInfo) return this._sourceInfo
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

  async fetchProjectInfo () {
    if (this._projectInfo) return this._projectInfo
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

  async findCompatibleVersion (framework) {
    const getBowerVersionInfo = async (version) => {
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
    const getMatchingVersion = async () => {
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
      const searchVersionInfo = async (framework, versionIndex = 0) => {
        const versioninfo = await getBowerVersionInfo(this.sourceVersions[versionIndex])
        // give up if there is any failure to obtain version info
        if (!this.isPresent) return null
        // check that the proposed plugin is compatible with the contraint and installed framework
        const satisfiesConstraint = !this.hasValidRequestVersion || semver.satisfies(versioninfo.version, this.requestedVersion, semverOptions)
        const satisfiesFramework = semver.satisfies(framework, versioninfo.framework, semverOptions)
        if (!this.latestCompatibleSourceVersion && satisfiesFramework) this.latestCompatibleSourceVersion = versioninfo.version
        const checkNext = (!satisfiesFramework || !satisfiesConstraint)
        const hasNoMoreVersions = (versionIndex + 1 >= this.sourceVersions.length)
        if (checkNext && hasNoMoreVersions) return null
        if (checkNext) return await searchVersionInfo(framework, versionIndex + 1)
        return versioninfo.version
      }
      return await searchVersionInfo(framework)
    }
    this.matchedVersion = await getMatchingVersion()
    this.canBeUpdated = (this.projectVersion && this.matchedVersion) && (this.projectVersion !== this.matchedVersion)
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

  /** @returns {string} */
  toString () {
    const isAny = (this.projectVersion === '*')
    return `${this.packageName}${isAny ? '' : `#${this.projectVersion}`}`
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

  /**
   * Read plugin data from pluginPath
   * @param {object} options
   * @param {string} options.pluginPath Path to source directory or source zip
   * @param {string} [options.projectPath=process.cwd()] Optional path to potential installation project
   * @returns {Plugin}
   */
  static async fromPath ({
    pluginPath,
    projectPath = process.cwd()
  }) {
    const plugin = new Plugin({
      name: pluginPath,
      cwd: projectPath
    })
    await plugin.fetchLocalSourceInfo()
    return plugin
  }

  static get instances () {
    return (Plugin._instances = Plugin._instances || [])
  }
}