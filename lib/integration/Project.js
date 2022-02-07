import fs from 'fs-extra'
import path from 'path'
import globs from 'globs'
import { readValidateJSON, readValidateJSONSync } from '../util/JSONReadValidate.js'
import Plugin from './Plugin.js'
import Target from './Target.js'
import chalk from 'chalk'
export const MANIFEST_FILENAME = 'adapt.json'
export const FRAMEWORK_FILENAME = 'package.json'

/**
 * A representation of the target Adapt Framework project
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

  /** @returns {boolean} */
  get containsManifestFile () {
    if (!this.isAdaptDirectory) return false
    return fs.existsSync(this.manifestFilePath)
  }

  /** @returns {string} */
  get version () {
    try {
      return readValidateJSONSync(this.frameworkPackagePath).version
    } catch (ex) {
      return null
    }
  }

  tryThrowInvalidPath () {
    if (this.containsManifestFile) return
    this.logger?.log(chalk.red('Fatal error: please run above commands in adapt course directory.'))
    throw new Error('Fatal error: please run above commands in adapt course directory.')
  }

  /** @returns {[Target]} */
  async getInstallTargets () {
    return Object.entries(await this.getManifestDependencies()).map(([name, requestedVersion]) => new Target({ name, requestedVersion, project: this, logger: this.logger }))
  }

  /** @returns {[string]} */
  async getManifestDependencies () {
    const manifest = await readValidateJSON(this.manifestFilePath)
    return manifest.dependencies
  }

  /** @returns {[Plugin]} */
  async getInstalledPlugins () {
    return Object.entries(await this.getInstalledDependencies()).map(([name]) => new Plugin({ name, project: this, logger: this.logger }))
  }

  /** @returns {[Target]} */
  async getUninstallTargets () {
    return Object.entries(await this.getInstalledDependencies()).map(([name]) => new Target({ name, project: this, logger: this.logger }))
  }

  /** @returns {[Target]} */
  async getUpdateTargets () {
    return Object.entries(await this.getInstalledDependencies()).map(([name]) => new Target({ name, project: this, logger: this.logger }))
  }

  async getInstalledDependencies () {
    const getDependencyBowerJSONs = async () => {
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
    const dependencies = (await getDependencyBowerJSONs())
      .filter(bowerJSON => bowerJSON?.name && bowerJSON?.version)
      .reduce((dependencies, bowerJSON) => {
        dependencies[bowerJSON.name] = bowerJSON.version
        return dependencies
      }, {})
    return dependencies
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
