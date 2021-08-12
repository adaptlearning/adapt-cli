import slug from 'speakingurl'

const zero = '0.0.0'

export default class Plugin {
  constructor (name, versionOrIsContrib, isContrib) {
    this.name = name
    if (typeof isContrib === 'undefined') {
      isContrib = false
    }
    if (typeof versionOrIsContrib === 'undefined') {
      isContrib = false
      this.version = '*'
    } else if (typeof versionOrIsContrib === 'boolean') {
      isContrib = versionOrIsContrib
      this.version = '*'
    } else {
      this.version = versionOrIsContrib === zero ? '*' : versionOrIsContrib
    }
    this.packageName = (/^adapt-/i.test(name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(name, { maintainCase: true })
  }

  get isContrib () {
    return /^adapt-contrib/.test(this.packageName)
  }

  toString () {
    let version = ''
    if (this.version !== '*') {
      version = '#' + this.version
    }
    return '' + this.packageName + version
  }
}
