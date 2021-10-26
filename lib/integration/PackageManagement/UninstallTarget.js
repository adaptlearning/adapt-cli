import Plugin from '../Plugin.js'
import endpointParser from 'bower-endpoint-parser'
import globs from 'globs'
import fs from 'fs-extra'
import path from 'path'

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

export default class UninstallTarget extends Plugin {
  /**
   * @param {string} name
   */
  constructor ({ name, project, logger } = {}) {
    const ep = endpointParser.decompose(name)
    const version = /^\*$/.test(ep.target) ? '*' : ep.target
    super({ name: ep.name || ep.source, version, logger: logger || project?.logger })
    this.project = project
    this._isMarkedForUninstall = undefined
    // marks that this target was uninstalled, true, false and undefined
    this._wasUninstalled = undefined
  }

  static parse (project, endpoint) {
    const ep = endpointParser.decompose(endpoint)
    return new UninstallTarget({ name: ep.name || ep.source, project })
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
    const info = await this.getInitialInfo()
    if (!info) return null
    return info.keywords
  }

  async getInitialInfo () {
    if (this._info) return this._info
    return (this._info = await new Promise((resolve, reject) => {
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
    }))
  }

  async markUninstallable () {
    if (!this.isPresent) return
    this.markRequestedForUninstallation()
  }

  markRequestedForUninstallation () {
    this._isMarkedForUninstall = true
  }

  get isMissing () {
    return !(this._info && this._path)
  }

  get isPresent () {
    return !this.isMissing
  }

  get isSkipped () {
    return !this.isPresent
  }

  get isToBeUninstalled () {
    return (this._isMarkedForUninstall === true)
  }

  get isUninstallSuccessful () {
    return (this._wasUninstalled === true)
  }

  get isUninstallFailure () {
    return (this._wasUninstalled === false)
  }

  async uninstall () {
    try {
      if (!this.isToBeUninstalled) throw new Error()
      await fs.rm(this._path, { recursive: true, force: true })
      this._wasUninstalled = true
    } catch (err) {
      this._wasUninstalled = false
      throw new Error(`There was a problem writing to the target directory ${this._path}`)
    }
  }
}
