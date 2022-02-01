import fs from 'fs-extra'
import path from 'path'
import globs from 'globs'
import { readValidateJSON, readValidateJSONSync } from '../util/JSONReadValidate.js'
import Plugin from './Plugin.js'
import chalk from 'chalk'
export const MANIFEST_FILENAME = 'adapt.json'
export const FRAMEWORK_FILENAME = 'package.json'

/**
 * a representation of the target Adapt project
 */
export default class Project {
  constructor ({
    cwd = process.cwd(),
    logger
  } = {}) {
    this.logger = logger
    this.cwd = cwd
    this.manifestFilePath = path.resolve(this.cwd, MANIFEST_FILENAME)
    this.frameworkPackagePath = path.resolve(this.cwd, FRAMEWORK_FILENAME)
  }

  /** @returns {boolean} */
  get isAdaptDirectory () {
    try {
      // are we inside an existing adapt_framework project.
      const packageJSON = fs.readJSONSync(this.cwd + '/package.json')
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

  async getDependencyBowerJSONs () {
    const glob = `${this.cwd.replace(/\\/g, '/')}/src/**/bower.json`
    const bowerJSONPaths = await new Promise((resolve, reject) => {
      globs(glob, (err, matches) => {
        if (err) return reject(err)
        resolve(matches)
      })
    })
    const bowerJSONs = []
    for (const bowerJSONPath of bowerJSONPaths) {
      try {
        bowerJSONs.push(await fs.readJSON(bowerJSONPath))
      } catch (err) {}
    }
    return bowerJSONs
  }

  async getInstalledDependencies () {
    const dependencies = (await this.getDependencyBowerJSONs())
      .filter(bowerJSON => bowerJSON?.name && bowerJSON?.version)
      .reduce((dependencies, bowerJSON) => {
        dependencies[bowerJSON.name] = bowerJSON.version
        return dependencies
      }, {})
    return dependencies
  }

  /** @returns {[Plugin]} */
  async getInstallTargets () {
    return Object.entries(await this.getPluginDependencies()).map(([name, requestedVersion]) => new Plugin({ name, requestedVersion, project: this, logger: this.logger }))
  }

  /** @returns {[Plugin]} */
  async getUninstallTargets () {
    return Object.entries(await this.getInstalledDependencies()).map(([name]) => new Plugin({ name, project: this, logger: this.logger }))
  }

  /** @returns {[Plugin]} */
  async getUpdateTargets () {
    return Object.entries(await this.getInstalledDependencies()).map(([name]) => new Plugin({ name, project: this, logger: this.logger }))
  }

  /** @returns {[string]} */
  async getPluginDependencies () {
    const manifest = await readValidateJSON(this.manifestFilePath)
    return manifest.dependencies
  }

  async getSchemaPaths () {
    const glob = `${this.cwd.replace(/\\/g, '/')}/src/**/*.schema.json`
    const bowerJSONPaths = await new Promise((resolve, reject) => {
      globs(glob, (err, matches) => {
        if (err) return reject(err)
        resolve(matches)
      })
    })
    return bowerJSONPaths
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
    manifest.dependencies[plugin.packageName] = plugin.source || plugin.requestedVersion || plugin.version
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
