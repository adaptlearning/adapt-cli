import Plugin from './Plugin.js'
import fs from 'fs'
import JsonLoader from './JsonLoader.js'
import JsonWriter from './JsonWriter.js'
const EmptyProject = function () {
  return {
    dependencies: {}
  }
}

const Project = function (manifestFilePath, frameworkPackagePath) {
  this.manifestFilePath = manifestFilePath
  this.frameworkPackagePath = frameworkPackagePath
  Object.defineProperty(this, 'plugins', {
    get: function () {
      const manifest = parse(this.manifestFilePath)
      return Object.entries(manifest.dependencies)
        .map(function (pair) {
          return new Plugin(pair[0], pair[1])
        })
    }.bind(this)
  })
}

Project.prototype.add = function (plugin) {
  if (typeof Plugin !== 'object' && plugin.constructor !== Plugin) {
    plugin = new Plugin(plugin)
  }
  let manifest
  if (this.isProjectContainsManifestFile()) {
    manifest = parse(this.manifestFilePath)
  } else {
    manifest = EmptyProject()
  }
  manifest.dependencies[plugin.packageName] = plugin.version
  save(this.manifestFilePath, manifest)
}

Project.prototype.remove = function (plugin) {
  if (typeof Plugin !== 'object' && plugin.constructor !== Plugin) {
    plugin = new Plugin(plugin)
  }
  const manifest = parse(this.manifestFilePath)
  delete manifest.dependencies[plugin.packageName]
  save(this.manifestFilePath, manifest)
}

Project.prototype.getFrameworkVersion = function () {
  return parsePackage(this.frameworkPackagePath).version
}

Project.prototype.isProjectContainsManifestFile = function () {
  return fs.existsSync(this.manifestFilePath)
}

function parse (manifestFilePath) {
  if (!manifestFilePath) return EmptyProject()

  return JsonLoader.readJSONSync(manifestFilePath)
}

function parsePackage (frameworkPackagePath) {
  const EmptyPackage = function () {
    return { version: '0.0.0' }
  }

  if (!frameworkPackagePath) return EmptyPackage()

  try {
    return JsonLoader.readJSONSync(frameworkPackagePath)
  } catch (ex) {
    return EmptyPackage()
  }
}

function save (manifestFilePath, manifest) {
  if (manifestFilePath) {
    JsonWriter.writeJSONSync(manifestFilePath, manifest)
  }
}

export default Project
