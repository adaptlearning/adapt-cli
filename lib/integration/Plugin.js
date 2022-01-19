import slug from 'speakingurl'

export default class Plugin {
  constructor ({ name, version = '*', isContrib = false, logger } = {}) {
    this.logger = logger
    this.name = name
    this.version = version === '0.0.0' ? '*' : version
    this.packageName = (/^adapt-/i.test(name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(name, { maintainCase: true })
  }

  /** @returns {boolean} */
  get isContrib () {
    return /^adapt-contrib/.test(this.packageName)
  }

  /** @type {string} */
  set version (value) {
    this._version = value
  }

  /** @type {string} */
  get version () {
    return this._version
  }

  /** @returns {string} */
  toString () {
    const isAny = (this.version === '*')
    return `${this.packageName}${isAny ? '' : `#${this.version}`}`
  }
}
