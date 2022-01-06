import Plugin from './Plugin.js'
import fs from 'fs-extra'
import path from 'path'
import globs from 'globs'
import { readValidateJSONSync } from '../util/JSONReadValidate.js'
import InstallTarget from './PluginManagement/InstallTarget.js'
import UninstallTarget from './PluginManagement/UninstallTarget.js'
import UpdateTarget from './PluginManagement/UpdateTarget.js'
import chalk from 'chalk'
export const MANIFEST_FILENAME = 'adapt.json'
export const FRAMEWORK_FILENAME = 'package.json'

/**
 * a representation of the target Adapt project
 */
export default class Project {
  constructor ({ localDir = process.cwd(), logger } = {}) {
    this.logger = logger
    this.localDir = localDir
    this.manifestFilePath = path.resolve(this.localDir, MANIFEST_FILENAME)
    this.frameworkPackagePath = path.resolve(this.localDir, FRAMEWORK_FILENAME)
  }

  /** @returns {boolean} */
  get isAdaptDirectory () {
    try {
      // are we inside an existing adapt_framework project.
      const packageJSON = fs.readJSONSync(this.localDir + '/package.json')
      return (packageJSON.name === 'adapt_framework')
    } catch (err) {
      // don't worry, we're not inside a framework directory.
    }
    return false
  }

  /** @returns {string} */
  get version () {
    try {
      return readValidateJSONSync(this.frameworkPackagePath).version
    } catch (ex) {
      return null
    }
  }

  throwInvalid () {
    if (this.containsManifestFile) return
    this.logger?.log(chalk.red('Fatal error: please run above commands in adapt course directory.'))
    throw new Error('Fatal error: please run above commands in adapt course directory.')
  }

  /** @returns {boolean} */
  get containsManifestFile () {
    if (!this.isAdaptDirectory) return false
    return fs.existsSync(this.manifestFilePath)
  }

  /** @returns {[Plugin]} */
  get plugins () {
    return Object.entries(this.pluginDependencies).map(([name, version]) => new Plugin({ name, version, logger: this.logger }))
  }

  /** @returns {[InstallTarget]} */
  get installTargets () {
    return Object.entries(this.pluginDependencies).map(([name, requestedVersion]) => new InstallTarget({ name, requestedVersion, project: this, logger: this.logger }))
  }

  /** @returns {[UninstallTarget]} */
  get uninstallTargets () {
    return Object.entries(this.pluginDependencies).map(([name]) => new UninstallTarget({ name, project: this, logger: this.logger }))
  }

  /** @returns {[UpdateTarget]} */
  get updateTargets () {
    return Object.entries(this.installedDependencies).map(([name]) => new UpdateTarget({ name, project: this, logger: this.logger }))
  }

  /** @returns {[string]} */
  get pluginDependencies () {
    const manifest = readValidateJSONSync(this.manifestFilePath)
    return manifest.dependencies
  }

  get installedDependencies () {
    const dependencies = this.dependencyBowerJSONs
      .filter(bowerJSON => bowerJSON?.name && bowerJSON?.version)
      .reduce((dependencies, bowerJSON) => {
        dependencies[bowerJSON.name] = bowerJSON.version
        return dependencies
      }, {})
    return dependencies
  }

  get dependencyBowerJSONs () {
    const glob = `${this.localDir.replace(/\\/g, '/')}/src/**/bower.json`
    const bowerJSONs = globs.sync(glob)
      .map(path => {
        try {
          return fs.readJSONSync(path)
        } catch (err) {
          return null
        }
      })
      .filter(Boolean)
    return bowerJSONs
  }

  /**
   * @param {Plugin} plugin
   */
  add (plugin) {
    if (typeof Plugin !== 'object' && !(plugin instanceof Plugin)) {
      plugin = new Plugin({ name: plugin })
    }
    let manifest
    if (this.containsManifestFile) {
      manifest = readValidateJSONSync(this.manifestFilePath)
    } else {
      manifest = { version: '0.0.0', dependencies: {} }
    }
    manifest.dependencies[plugin.packageName] = plugin.version
    fs.writeJSONSync(this.manifestFilePath, manifest, { spaces: 2, replacer: null })
  }

  /**
   * @param {Plugin} plugin
   */
  remove (plugin) {
    if (typeof Plugin !== 'object' && !(plugin instanceof Plugin)) {
      plugin = new Plugin({ name: plugin })
    }
    const manifest = readValidateJSONSync(this.manifestFilePath)
    delete manifest.dependencies[plugin.packageName]
    fs.writeJSONSync(this.manifestFilePath, manifest, { spaces: 2, replacer: null })
  }
}
