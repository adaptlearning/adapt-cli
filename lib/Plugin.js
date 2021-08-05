import slug from './Slug.js'
import endpointParser from 'bower-endpoint-parser'
const zero = '0.0.0'
const any = '*'

export default class Plugin {
  constructor (name, versionOrIsContrib, isContrib) {
    this.name = name

    if (typeof isContrib === 'undefined') {
      isContrib = false
    }
    if (typeof versionOrIsContrib === 'undefined') {
      isContrib = false
      this.version = any
    } else if (typeof versionOrIsContrib === 'boolean') {
      isContrib = versionOrIsContrib
      this.version = any
    } else {
      this.version = versionOrIsContrib === zero ? any : versionOrIsContrib
    }
    this.packageName = makePackageName(name, isContrib)
  }

  get isContrib () {
    return /^adapt-contrib/.test(this.packageName)
  }

  toString () {
    let version = ''
    if (this.version !== any) {
      version = '#' + this.version
    }
    return '' + this.packageName + version
  }

  static parse (endpoint) {
    const ep = endpointParser.decompose(endpoint)
    const version = /^\*$/.test(ep.target) ? any : ep.target
    return new Plugin(ep.name || ep.source, version)
  }

  static compose (endpoint) {
    return Plugin.parse(endpointParser.compose(endpoint))
  }
}

function makePackageName (name, isContrib) {
  return (/^adapt-/i.test(name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(name)
}
