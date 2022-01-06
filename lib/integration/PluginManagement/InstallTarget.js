import Plugin from '../Plugin.js'
import bower from 'bower'
import endpointParser from 'bower-endpoint-parser'
import semver from 'semver'
import fs from 'fs-extra'
import path from 'path'
import errors from '../../util/errors.js'
import getBowerRegistry from './getBowerRegistry.js'

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

export default class InstallTarget extends Plugin {
  /**
   * @param {string} name
   * @param {string} requestedVersion
   * @param {boolean} isCompatibleEnabled whether to target the latest compatible version for all plugin installations (overrides constraints)
   */
  constructor ({ name, requestedVersion = '*', isCompatibleEnabled = InstallTarget.isCompatibleEnabled, project, logger } = {}) {
    const endpoint = name + '#' + (isCompatibleEnabled ? '*' : requestedVersion)
    const ep = endpointParser.decompose(endpoint)
    const version = /^\*$/.test(ep.target) ? '*' : ep.target
    super({ name: ep.name || ep.source, version, logger: logger || project?.logger })
    this.project = project
    this.BOWER_REGISTRY_URL = getBowerRegistry(project)
    let proposal
    if (this.version !== '*') {
      proposal = this.version
      this._isConstrained = true
      this.version = semver.validRange(proposal)
      if (!this.version) {
        throw new Error(this.packageName + ' "' + proposal + '" is not a valid constraint')
      }
    }
    // the constraint given by the user
    this._requestedVersion = requestedVersion
    // the result of the current query to the server
    this._rawInfo = null
    // information about a particular version of the plugin
    this._versionInfo = null
    // the number of attempts made to query the server
    this._bowerCmdCount = 0
    // a list of tags denoting the versions of the plugin
    this._versions = null
    // an index denoting which version is being queried
    this._versionIndex = 0
    // whether querying the server for plugin information failed at all
    this._isMissingAtRepo = false
    // the most recent version of the plugin compatible with the given framework
    this._latestCompatibleVersion = null
    // the most recent version of the plugin
    this._latestVersion = null
    // whether the user supplied a constraint that is not supported by the plugin
    this._isBadConstraint = false
    // whether the constraint has been checked for compatibility
    this._constraintChecked = false
    // a non-wildcard constraint resolved to the highest version of the plugin that satisfies the constraint and is compatible with the framework
    this._resolvedConstraint = null
    // the version to be installed
    this._versionToInstall = null
    // marks that this target was installed, true, false and null
    this._wasInstalled = null
  }

  static parse (project, endpoint) {
    const ep = endpointParser.decompose(endpoint)
    const version = /^\*$/.test(ep.target) ? '*' : ep.target
    return new InstallTarget({ name: ep.name || ep.source, version, project })
  }

  toString () {
    let version = ''
    if (this.version !== '*') {
      version = '#' + this._versionToInstall
    }
    return '' + this.packageName + version
  }

  async getInitialInfo () {
    await this.getBowerInfo()
    if (this._isMissingAtRepo) return
    this._latestVersion = this._versionInfo.version
    if (!this._rawInfo.versions) return
    this._versions = this._rawInfo.versions
    if (this._versions.length === 0) return
    // check if the user supplied a constraint that cannot be met
    this._isBadConstraint = semver.maxSatisfying(this._versions, this.version) === null
  }

  /**
   *
   * @param {Object} [config]
   * @returns {TYPE}
   */
  async getType (config = {}) {
    if (this._type) return this._type
    config.registry = config.registry ?? this.BOWER_REGISTRY_URL
    const keywords = await this.getKeywords(config)
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

  async getBowerInfo (config = {}) {
    const perform = async (attemptCount = 0) => {
      try {
        config.registry = config.registry ?? this.BOWER_REGISTRY_URL
        const info = (this._info = await new Promise((resolve, reject) => {
          const versionString = this._versions ? `#${this._versions[this._versionIndex]}` : ''
          bower.commands.info(`${this.packageName}${versionString}`, null, { cwd: this.project.localDir, ...config })
            .on('end', resolve)
            .on('error', reject)
        }))
        this._rawInfo = info
        this._versionInfo = info.latest || info
      } catch (err) {
        const isFinished = (err?.code === 'ENOTFOUND' || attemptCount >= BOWER_MAX_TRY)
        if (isFinished) return (this._isMissingAtRepo = true)
        return await perform(attemptCount++)
      }
    }
    await perform()
    return this._rawInfo
  }

  async getKeywords (config = {}) {
    if (this._keywords) return this._keywords
    config.registry = config.registry ?? this.BOWER_REGISTRY_URL
    return (this._keywords = await new Promise((resolve, reject) => {
      bower.commands.info(this.toString(), 'keywords', { cwd: this.project.localDir, ...config })
        .on('end', resolve)
        .on('error', reject)
    }))
  }

  async getRepositoryUrl (config = {}) {
    if (this._repositoryUrl) return this._repositoryUrl
    config.registry = config.registry ?? this.BOWER_REGISTRY_URL
    return (this._repositoryUrl = await new Promise((resolve, reject) => {
      bower.commands.lookup(this.toString(), { cwd: this.project.localDir, ...config })
        .on('end', resolve)
        .on('error', reject)
    }))
  }

  async findCompatibleVersion (framework) {
    if (this._isMissingAtRepo) return
    // check if the latest version is compatible
    if (semver.satisfies(framework, this._versionInfo.framework)) {
      this._latestCompatibleVersion = this._versionInfo.version || '*'
      return
    }
    // if the plugin has no tags then there are no other versions to check
    if (!this._versions || this._versions.length === 0) return
    this._versionIndex = 0
    return await this.checkProposedVersion(framework)
  }

  async checkConstraint (framework) {
    // check that the plugin exists
    if (this._isMissingAtRepo) {
      this._constraintChecked = true
      // this.logger.log(this.packageName, 'cannot resolve constraint due to missing info')
      return
    }
    // check that there are other versions to be considered
    if (!this._versions || this._versions.length === 0) {
      this._constraintChecked = true
      // this.logger.log(this.packageName, 'cannot resolve constraint because there are no tags')
      return
    }
    // check that a valid constraint exists
    if (this.version === '*' || this._isBadConstraint) {
      this._constraintChecked = true
      // this.logger.log(this.packageName, 'cannot resolve constraint because a valid constraint has not been given')
      return
    }
    this._versionIndex = 0
    await this.getBowerInfo()
    return await this.checkConstraintCompatibility(framework)
  }

  // find the highest version that satisfies the constraint and is compatible with the framework
  async checkConstraintCompatibility (framework) {
    // give up if there is any failure to obtain version info
    if (this._isMissingAtRepo) {
      this._constraintChecked = true
      // this.logger.log(this.packageName, 'cannot resolve constraint due to missing info');
      return
    }
    // this.logger.log(this.packageName, 'checking', this._versionInfo.version, 'against', this.version, 'framework', framework);
    // check if the version satisfies the constraint and whether the version is compatible
    if (semver.satisfies(this._versionInfo.version, this.version) && semver.satisfies(framework, this._versionInfo.framework)) {
      this._resolvedConstraint = this._versionInfo.version
      this._constraintChecked = true
      // this.logger.log(this.packageName, 'resolved constraint to', this._resolvedConstraint);
      return
    }
    if (this._versionIndex + 1 < this._versions.length) {
      this._versionIndex++
      await this.getBowerInfo()
      return await this.checkConstraintCompatibility(framework)
    }
    this._resolvedConstraint = null
    this._constraintChecked = true
    // this.logger.log(this.packageName, 'cannot resolve constraint');
  }

  // find the highest version that is compatible with the framework
  async checkProposedVersion (framework) {
    // give up if there is any failure to obtain version info
    if (this._isMissingAtRepo) {
      this._latestCompatibleVersion = null
      return
    }
    // check that the proposed plugin is compatible with the installed framework
    if (semver.satisfies(framework, this._versionInfo.framework)) {
      this._latestCompatibleVersion = this._versionInfo.version
      return
    }
    if (this._versionIndex + 1 < this._versions.length) {
      this._versionIndex++
      await this.getBowerInfo()
      return await this.checkProposedVersion(framework)
    }
    this._latestCompatibleVersion = null
  }

  markRequestedForInstallation () {
    if (this._resolvedConstraint !== null) {
      this._versionToInstall = this._resolvedConstraint
    } else {
      this._versionToInstall = semver.maxSatisfying(this._versions, this.version)
    }
  }

  markLatestCompatibleForInstallation () {
    this._versionToInstall = this._latestCompatibleVersion
  }

  markLatestForInstallation () {
    this._versionToInstall = this._latestVersion
  }

  logToConsole () {
    console.log(this.packageName, this.version, this._versionInfo ? this._versionInfo.framework : 'missing')
  }

  async markInstallable () {
    if (!this.isPresent) {
      // TODO: check if there is an error for this
      return
    }
    if (this.isVerifiedForInstallation) return this.markLatestCompatibleForInstallation()
    // there is no compatible version, but the user requested a valid version which is not the latest (prompt for (r)equested, (l)atest or (s)kip)
    if (this.isVerifiedForInstallation) return (this._error = errors.ERROR_INCOMPATIBLE_VALID_REQUEST)
    // there is no compatible version, but the user requested the latest version (prompt for (l)atest or (s)kip)
    if (this.isIncompatibleWithLatestConstraint) return (this._error = errors.ERROR_INCOMPATIBLE_VALID_REQUEST)
    // there is no compatible version, but the user requested an invalid version (prompt for (l)atest or (s)kip)
    if (this.isIncompatibleWithBadConstraint) return (this._error = errors.ERROR_INCOMPATIBLE_BAD_REQUEST)
    // there is no compatible version and no constraint was given (prompt for (l)atest or (s)kip)
    if (this.isIncompatibleWithNoConstraint) return (this._error = errors.ERROR_INCOMPATIBLE)
    // a compatible version exists but the user requested an older version that isn't compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
    if (this.isCompatibleWithOldIncompatibleConstraint) return (this._error = errors.ERROR_COMPATIBLE_INC_REQUEST)
    // a compatible version exists but the user requested an older version that is compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
    if (this.isCompatibleWithOldCompatibleConstraint) return this.markRequestedForInstallation()
    // a compatible version exists but the user requested a newer version that is compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
    if (this.isCompatibleWithNewCompatibleConstraint) return this.markRequestedForInstallation()
    // a compatible version exists but the user gave a bad constraint (prompt for (c)ompatible or (s)kip)
    if (this.isCompatibleWithBadConstraint) return (this._error = errors.ERROR_COMPATIBLE_BAD_REQUEST)
    // a compatible version exists but user has requested a valid version that is later than the latest compatible version (prompt for (r)equested, (l)atest compatible or (s)kip)
    if (this.isCompatibleWithUnmetConstraint) return (this._error = errors.ERROR_COMPATIBLE_INC_REQUEST)
  }

  async install () {
    const type = await this.getType()
    const outputPath = path.join(this.project.localDir, 'src', type.belongsTo)
    const pluginPath = path.join(outputPath, this.name)
    try {
      await fs.rm(pluginPath, { recursive: true, force: true })
    } catch (err) {
      throw new Error(`There was a problem writing to the target directory ${pluginPath}`)
    }
    await new Promise((resolve, reject) => {
      const pluginNameVersion = `${this.packageName}#${this._versionToInstall}`
      bower.commands.install([pluginNameVersion], null, {
        directory: outputPath,
        cwd: this.project.localDir,
        registry: this.BOWER_REGISTRY_URL
      })
        .on('end', resolve)
        .on('error', err => {
          err = new Error(`Bower reported ${err}`)
          this._wasInstalled = false
          this._error = err
          reject(err)
        })
    })
    this._wasInstalled = true
  }

  // simple filters

  get isToBeInstalled () {
    return this._versionToInstall !== null
  }

  get isInstallSuccessful () {
    return this._versionToInstall !== null && this._wasInstalled === true
  }

  get isInstallFailure () {
    return this._versionToInstall !== null && this._wasInstalled === false
  }

  get isSkipped () {
    return !this._isMissingAtRepo && this._versionToInstall === null
  }

  get isConstraintCompatible () {
    return this._resolvedConstraint !== null && this._resolvedConstraint != null
  }

  get isCompatible () {
    return this._latestCompatibleVersion !== null && this._latestCompatibleVersion != null
  }

  get isConstrained () {
    return this.version !== '*'
  }

  get isGoodConstraint () {
    return this._isBadConstraint === false
  }

  get isBadConstraint () {
    return this._isBadConstraint === true
  }

  get isMissing () {
    return this._isMissingAtRepo === true
  }

  get isPresent () {
    return !this.isMissing
  }

  // composite filter for when no user input is required to determine which version to install

  get isVerifiedForInstallation () {
    return this.isCompatible && (!this.isConstrained || semver.satisfies(this._resolvedConstraint, this._latestCompatibleVersion))
  }

  // composite filters for when no compatible version exists

  get isIncompatibleWithOldConstraint () {
    return !this._isMissingAtRepo && !this.isCompatible && this.isConstrained && this.isGoodConstraint && semver.lt(semver.maxSatisfying(this._versions, this.version), this._latestVersion)
  }

  get isIncompatibleWithLatestConstraint () {
    return !this._isMissingAtRepo && !this.isCompatible && this.isConstrained && this.isGoodConstraint && semver.satisfies(semver.maxSatisfying(this._versions, this.version), this._latestVersion)
  }

  get isIncompatibleWithBadConstraint () {
    return !this._isMissingAtRepo && !this.isCompatible && this.isConstrained && this.isBadConstraint
  }

  get isIncompatibleWithNoConstraint () {
    return !this._isMissingAtRepo && !this.isCompatible && !this.isConstrained
  }

  // composite filters for when a compatible version exists

  get isCompatibleWithOldCompatibleConstraint () {
    return this.isCompatible && this.isConstraintCompatible && semver.lt(this._resolvedConstraint, this._latestCompatibleVersion)
  }

  get isCompatibleWithBadConstraint () {
    return this.isCompatible && this.isBadConstraint
  }

  get isCompatibleWithOldIncompatibleConstraint () {
    // when the following elements of the filter are true they imply:
    //
    // isCompatible - there exists a compatible version
    // isConstrained - a constraint was given (i.e. not a wildcard '*')
    // isGoodConstraint - the constraint resolved to a version of the plugin
    // not isConstraintCompatible - the constraint did not resolve to a compatible version
    //
    // the last element determines if the constraint only specified version(s) less than the latest compatible version
    return this.isCompatible && this.isConstrained && this.isGoodConstraint && !this.isConstraintCompatible && semver.lt(semver.maxSatisfying(this._versions, this.version), this._latestCompatibleVersion)
  }

  get isCompatibleWithUnmetConstraint () {
    // when the following elements of the filter are true they imply:
    //
    // isCompatible - there exists a compatible version
    // isConstrained - a constraint was given (i.e. not a wildcard '*')
    // isGoodConstraint - the constraint resolved to a version of the plugin
    // not isConstraintCompatible - the constraint did not resolve to a compatible version
    //
    // the last element determines if the constraint specified version(s) greater than the latest compatible version
    return this.isCompatible && this.isConstrained && this.isGoodConstraint && !this.isConstraintCompatible && semver.gt(semver.maxSatisfying(this._versions, this.version), this._latestCompatibleVersion)
  }

  get isCompatibleWithNewCompatibleConstraint () {
    return this.isCompatible && this.isConstrained && this.isGoodConstraint && this.isConstraintCompatible && semver.gt(semver.maxSatisfying(this._versions, this.version), this._latestCompatibleVersion)
  }
}
