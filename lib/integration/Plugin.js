import slug from 'speakingurl'

export default class Plugin {
  constructor ({ name, version = '*', isContrib = false } = {}) {
    this.name = name
    this.version = version === '0.0.0' ? '*' : version
    this.packageName = (/^adapt-/i.test(name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(name, { maintainCase: true })
  }

  /** @returns {boolean} */
  get isContrib () {
    return /^adapt-contrib/.test(this.packageName)
  }

  /** @returns {string} */
  toString () {
    let version = ''
    if (this.version !== '*') {
      version = '#' + this.version
    }
    return '' + this.packageName + version
  }
}
