import Plugin from '../Plugin.js'
import endpointParser from 'bower-endpoint-parser'
import bower from 'bower'
import semver from 'semver'
import globs from 'globs'
import fs from 'fs-extra'
import path from 'path'
import { readValidateJSONSync } from '../../util/JSONReadValidate.js'

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

export default class UpdateTarget extends Plugin {
  /**
   * @param {string} name
   */
  constructor ({ name, project, logger } = {}) {
    const ep = endpointParser.decompose(name)
    const version = /^\*$/.test(ep.target) ? '*' : ep.target
    super({ name: ep.name || ep.source, version, logger: logger || project?.logger })
    this.project = project
    this._diskInfo = null
    this._bowerInfo = null
    this._installedVersion = null

    // an index denoting which version is being queried
    this._versionIndex = 0
    // the number of attempts made to query the server
    this._bowerCmdCount = 0
    this._isAtLatestVersion = null
    this._isAtBestVersion = null
    this._proposedVersion = null
    this._shouldBeUpdated = null
    this._isMarkedForUpdate = null
    // marks that this target was updated, true, false and null
    this._wasUpdated = null
  }

  static parse (project, endpoint) {
    const ep = endpointParser.decompose(endpoint)
    return new UpdateTarget({ name: ep.name || ep.source, project })
  }

  /**
   * @returns {TYPE}
   */
  async getType () {
    if (this._type) return this._type
    const keywords = await this.getKeywords()
    if (!keywords) return
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
    const info = await this.getDiskInfo()
    if (!info) return null
    return info.keywords
  }

  async getInfo () {
    await this.getDiskInfo()
    await this.getBowerInfo()
  }

  async getDiskInfo () {
    if (this._diskInfo) return this._diskInfo
    this._diskInfo = await new Promise((resolve, reject) => {
      // get bower.json data
      const glob = `${this.project.localDir.replace(/\\/g, '/')}/src/**/bower.json`
      globs(glob, (err, matches) => {
        if (err) return resolve(null)
        const tester = new RegExp(`/${this.packageName}/`, 'i')
        const match = matches.find(match => tester.test(match))
        if (!match) return resolve(null)
        this._path = path.resolve(match, '../')
        resolve(fs.readJSONSync(match))
      })
    })
    this._installedVersion = this._diskInfo.version
    return this._diskInfo
  }

  async getBowerInfo (config = {}) {
    const perform = async (attemptCount = 0) => {
      try {
        config.registry = config.registry ?? this.BOWER_REGISTRY_CONFIG
        const versionString = this._versions ? `#${this._versions[this._versionIndex]}` : ''
        const info = await new Promise((resolve, reject) => {
          bower.commands.info(`${this.packageName}${versionString}`, null, { cwd: this.project.localDir, ...config })
            .on('end', resolve)
            .on('error', reject)
        })
        this._bowerInfo = info.latest || info
        this._versions = info.versions ?? this._versions
      } catch (err) {
        const isFinished = (err?.code === 'ENOTFOUND' || attemptCount >= BOWER_MAX_TRY)
        if (isFinished) return (this._isMissingAtRepo = true)
        return await perform(attemptCount++)
      }
    }
    await perform()
    return this._bowerInfo
  }

  isNameMatch (name) {
    const tester = new RegExp(`${name}$`, 'i')
    return tester.test(this.packageName)
  }

  async getTargetVersion (framework) {
    // if the plugin has no tags then there are no other versions to check
    if (!this._versions || this._versions.length === 0) return

    // if plugin already at latest version then nothing to do
    const satisfiesFramework = semver.satisfies(framework, this._bowerInfo.framework)
    const isLatest = semver.satisfies(this._installedVersion, this._bowerInfo.version)
    if (satisfiesFramework && isLatest) {
      // console.log('at latest for', this.packageName, this._installedVersion, this._bowerInfo.version)
      this._isAtLatestVersion = true
      return
    }

    // console.log('searching', this.packageName, this._installedVersion, this._bowerInfo)
    this._versionIndex = 0
    await this.checkProposedVersion(framework)
  }

  // find the highest version that is compatible with the framework
  async checkProposedVersion (framework) {
    // give up if there is any failure to obtain version info
    if (this._isMissingAtRepo) {
      this._proposedVersion = null
      return
    }
    // check that the proposed plugin is compatible with the contraint and installed framework
    const satisfiesConstraint = semver.satisfies(this._bowerInfo.version, this.version)
    const satisfiesFramework = semver.satisfies(framework, this._bowerInfo.framework)
    if (satisfiesFramework && satisfiesConstraint) {
      this._proposedVersion = this._bowerInfo.version
      this._shouldBeUpdated = (this._proposedVersion !== this._installedVersion)
      if (!this._shouldBeUpdated) {
        this._isAtBestVersion = true
        // console.log('at best fit for', this.packageName, this._installedVersion, this._bowerInfo.version)
      }
      return
    }
    if (this._versionIndex + 1 < this._versions.length) {
      this._versionIndex++
      await this.getBowerInfo()
      return await this.checkProposedVersion(framework)
    }
    this._proposedVersion = null
  }

  async markUpdateable () {
    if (!this.isPresent) return
    this.markRequestedForUpdating()
  }

  markRequestedForUpdating () {
    this._isMarkedForUpdate = true
  }

  get isMissing () {
    return !this._diskInfo || this._isMissingAtRepo
  }

  get isPresent () {
    return !this.isMissing
  }

  get isSkipped () {
    return !this.isPresent
  }

  get isToBeUpdated () {
    return (this._isMarkedForUpdate === true)
  }

  get isUpdateSuccessful () {
    return (this._wasUpdated === true)
  }

  get isUpdateFailure () {
    return (this._wasUpdated === false)
  }

  get isIncompatible () {
    return !semver.valid(this._proposedVersion)
  }

  get isConstrained () {
    return (this.version !== '*')
  }

  get isUntagged () {
    return (!this._versions || this._versions.length === 0)
  }

  async update () {
    if (!this.isToBeUpdated) throw new Error()
    const type = await this.getType()
    const outputPath = path.join(this.project.localDir, 'src', type.belongsTo)
    const pluginPath = path.join(outputPath, this.name)
    try {
      await fs.rm(pluginPath, { recursive: true, force: true })
    } catch (err) {
      throw new Error(`There was a problem writing to the target directory ${pluginPath}`)
    }
    await new Promise((resolve, reject) => {
      const pluginNameVersion = `${this.packageName}#${this._proposedVersion}`
      bower.commands.install([pluginNameVersion], null, {
        directory: outputPath,
        cwd: this.project.localDir,
        registry: this.BOWER_REGISTRY_CONFIG
      })
        .on('end', resolve)
        .on('error', err => {
          err = new Error(`Bower reported ${err}`)
          this._wasUpdated = false
          this._error = err
          reject(err)
        })
    })
    this._wasUpdated = true
    this._bowerInfo = readValidateJSONSync(path.join(process.cwd(), 'src', this.type.belongsTo, this.packageName, 'bower.json'))
    this._updatedVersion = this._bowerInfo.version
  }
}
