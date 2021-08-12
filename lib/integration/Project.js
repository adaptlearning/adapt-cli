import Plugin from './Plugin.js'
import fs from 'fs-extra'
import path from 'path'
import { readValidateJSONSync } from '../util/JSONReadValidate.js'
import InstallTarget from './PackageManagement/InstallTarget.js'
export const MANIFEST_FILENAME = 'adapt.json'
export const FRAMEWORK_FILENAME = 'package.json'
export function DEFAULT_PROJECT_MANIFEST_PATH () { return path.join(process.cwd(), MANIFEST_FILENAME) }
export function DEFAULT_PROJECT_FRAMEWORK_PATH () { return path.join(process.cwd(), FRAMEWORK_FILENAME) }

/**
 * a representation of the target Adapt project
 */
export default class Project {
  constructor (manifestFilePath = DEFAULT_PROJECT_MANIFEST_PATH(), frameworkPackagePath = DEFAULT_PROJECT_FRAMEWORK_PATH()) {
    this.manifestFilePath = manifestFilePath
    this.frameworkPackagePath = frameworkPackagePath
  }

  get isCWDAdapt () {
    try {
      // are we inside an existing adapt_framework project.
      const packageJson = fs.readJSONSync(process.cwd() + '/package.json')
      return (packageJson.name === 'adapt_framework')
    } catch (err) {
      // don't worry, we're not inside a framework directory.
    }
    return false
  }

  get plugins () {
    return Object.entries(this.pluginDependencies).map(([name, version]) => new Plugin(name, version))
  }

  get installTargets () {
    return Object.entries(this.pluginDependencies).map(([name, version]) => new InstallTarget(name, version))
  }

  get pluginDependencies () {
    const manifest = readValidateJSONSync(this.manifestFilePath)
    return manifest.dependencies
  }

  add (plugin) {
    if (typeof Plugin !== 'object' && plugin.constructor !== Plugin) {
      plugin = new Plugin(plugin)
    }
    let manifest
    if (this.isProjectContainsManifestFile()) {
      manifest = readValidateJSONSync(this.manifestFilePath)
    } else {
      manifest = { version: '0.0.0', dependencies: {} }
    }
    manifest.dependencies[plugin.packageName] = plugin.version
    fs.writeJSONSync(this.manifestFilePath, manifest, { spaces: 2, replacer: null })
  }

  remove (plugin) {
    if (typeof Plugin !== 'object' && plugin.constructor !== Plugin) {
      plugin = new Plugin(plugin)
    }
    const manifest = readValidateJSONSync(this.manifestFilePath)
    delete manifest.dependencies[plugin.packageName]
    fs.writeJSONSync(this.manifestFilePath, manifest, { spaces: 2, replacer: null })
  }

  getFrameworkVersion () {
    try {
      return readValidateJSONSync(this.frameworkPackagePath).version
    } catch (ex) {
      return null
    }
  }

  isProjectContainsManifestFile () {
    if (!this.isCWDAdapt) return false
    return fs.existsSync(this.manifestFilePath)
  }
}
