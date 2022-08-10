import http from 'http' // api http import, to hold open process for testing
import { ADAPT_FRAMEWORK } from './util/constants.js'
import {
  build,
  download,
  erase,
  getLatestVersion,
  npmInstall,
  deleteSrcCourse,
  deleteSrcCore
} from './integration/AdaptFramework.js'
import {
  install,
  uninstall,
  update,
  schemas
} from './integration/PluginManagement.js'
import Plugin from './integration/Plugin.js'
import Project from './integration/Project.js'
import fs from 'fs-extra'
import async from 'async'
import './econnreset.js'

// TODO: api, check no interactivity, should be sorted, will fail silently if it absolutely cannot do what you've asked
// TODO: api, console and error output, error on fail when isInteractive: false? or something else? return Targets?
// TODO: api, figure out error translations, should probably error with codes?

class API {
  /**
   * Installs a clean copy of the framework
   * @param {Object} options
   * @param {string} [options.version=null] Specific version of the framework to install
   * @param {string} [options.repository] URL to github repo
   * @param {string} [options.cwd=process.cwd()] Directory to install into
   * @return {Promise}
   */
  async installFramework ({
    version = null,
    repository = ADAPT_FRAMEWORK,
    cwd = process.cwd()
  } = {}) {
    if (!version) version = await getLatestVersion({ repository })
    await erase({
      isInteractive: false,
      cwd
    })
    await download({
      repository,
      branch: version,
      cwd
    })
    await deleteSrcCourse({
      cwd
    })
    await deleteSrcCore({
      cwd
    })
    await npmInstall({
      cwd
    })
  }

  /**
   * @param {Object} options
   * @param {Object} [options.repository=ADAPT_FRAMEWORK] The github repository url
   * @returns {string}
   */
  async getLatestFrameworkVersion ({
    repository = ADAPT_FRAMEWORK
  } = {}) {
    return getLatestVersion({ repository })
  }

  /**
   * Runs build for a current course
   * @param {Object} options
   * @param {boolean} [options.sourceMaps=false] Whether to run the build with sourcemaps
   * @param {boolean} [options.checkJSON=false] Whether to run without checking the json
   * @param {boolean} [options.cache=true] Whether to clear build caches
   * @param {string} [options.outputDir="build/"] Root path of the framework installation
   * @param {string} [options.cachePath="build/.cache"] Path of compilation cache file
   * @param {string} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise}
   */
  async buildCourse ({
    sourceMaps = false,
    checkJSON = false,
    cache = true,
    outputDir = null,
    cachePath = './build/.cache',
    cwd = process.cwd()
  } = {}) {
    await build({
      sourceMaps,
      checkJSON,
      cache,
      cwd,
      outputDir,
      cachePath
    })
  }

  /**
   * Installs multiple plugins
   * Can install from source folder or bower registry
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An array with name@version or name@path strings
   * @param {string} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise<[Target]>}
   */
  async installPlugins ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    return await install({
      plugins,
      isInteractive: false,
      cwd
    })
  }

  /**
   * Uninstalls multiple plugins
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An array with name@version or name@path strings
   * @param {string} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise<[Target]>}
   */
  async uninstallPlugins ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    return await uninstall({
      plugins,
      isInteractive: false,
      cwd
    })
  }

  /**
   * Updates multiple plugins
   * Can install from source folder or bower registry
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An array with name@version or name@path strings
   * @param {string} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise<[Target]>}
   */
  async updatePlugins ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    return await update({
      plugins,
      isInteractive: false,
      cwd
    })
  }

  /**
   * Retrieves all schemas defined in the project
   * Clears schema cache
   * @param {string} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise<[string]>} Resolves with array of JSON schema filepaths
   */
  async getSchemaPaths ({
    cwd = process.cwd()
  } = {}) {
    this._schemaPaths = await schemas({ cwd })
    this._schemas = {}
    return this._schemaPaths
  }

  /**
   * Retrieves named schema
   * Caches schemas for subsequent use
   * Call getSchemaPaths to reset cache
   * @param {string} options.name Schema filepath as returned from getSchemaPaths
   * @return {Promise<Object>} Resolves with the JSON schema contents
   */
  async getSchema ({
    name
  } = {}) {
    if (!this._schemaPaths) return new Error('Please run getSchemaPaths first')
    if (!fs.existsSync(name) || !this._schemaPaths.includes(name)) throw new Error(`Schema does not exist: ${name}`)
    return (this._schemas[name] = this._schemas[name] ?? await fs.readJSON(name))
  }

  /**
   * Returns all installed plugins
   * @return {Promise<[Plugin]>}
   */
  async getInstalledPlugins ({
    cwd = process.cwd()
  } = {}) {
    const project = new Project({ cwd })
    if (!project.isAdaptDirectory) throw new Error(`Not in an adapt folder at: ${cwd}`)
    const installedPlugins = await project.getInstalledPlugins()
    for (const plugin of installedPlugins) {
      await plugin.fetchProjectInfo()
    }
    return installedPlugins
  }

  /**
   * Gets the update information for installed and named plugins
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An y of plugin names (if not specified, all plugins are checked)
   * @param {string} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise<[Plugin]>}
   */
  async getPluginUpdateInfos ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    /** @type {Project} */
    const project = new Project({ cwd })
    if (!project.isAdaptDirectory) throw new Error(`Not in an adapt folder at: ${cwd}`)
    const frameworkVersion = project.version
    /** @type {[Plugin]} */
    const installedPlugins = await project.getInstalledPlugins()
    const filteredPlugins = !plugins?.length
      ? installedPlugins
      : plugins
        .map(name => installedPlugins.find(plugin => plugin.packageName === name))
        .filter(Boolean)
    await async.eachOfLimit(filteredPlugins, 8, async plugin => {
      await plugin.fetchProjectInfo()
      await plugin.fetchBowerInfo()
      await plugin.findCompatibleVersion(frameworkVersion)
    })
    return filteredPlugins
  }

  /**
   * Returns an object representing the plugin at the path specified
   * @returns {Plugin}
   */
  async getPluginFromPath ({
    pluginPath,
    cwd = null
  } = {}) {
    const project = cwd ? new Project({ cwd }) : null
    return Plugin.fromPath({ pluginPath, project })
  }
}

const api = new API()
export default api

// debugging
if (process.argv.includes('--debug-wait')) {
  // http server to hold open process for testing
  const a = http.createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/plain' })
    response.end('test', 'utf-8')
  })
  a.listen(999)
  // make api global to debug more easily
  global.api = api
  console.log('API Ready')
}
