import http from 'http' // TEMPORARY: api http import, to hold open process for testing
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

// TODO: api, check no interactivity
// TODO: api, figure out error translations, should probably error with codes?

class API {
  /**
   * Installs a clean copy of the framework
   * @param {object} options
   * @param {String} [options.version=null] Specific version of the framework to install
   * @param {String} [options.repository] URL to github repo
   * @param {String} [options.cwd=process.cwd()] Directory to install into
   * @return {Promise}
   */
  async installFramework ({
    version = null,
    repository = ADAPT_FRAMEWORK,
    cwd = process.cwd()
  } = {}) {
    if (!version) version = await getLatestVersion({ repository })
    await erase({
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

  async updateFramework ({
    version = null,
    repository = ADAPT_FRAMEWORK,
    cwd = process.cwd()
  } = {}) {
    // TODO: api.updateFramework Going to have to figure out how to preserve the plugins over fw installs / updates
    // - Perhaps carry on cloning the framework and delete src/core before npminstall?
  }

  async getLatestFrameworkVersion ({
    repository = ADAPT_FRAMEWORK
  }) {
    return await getLatestVersion({ repository })
  }

  /**
   * Runs build for a current course
   * @param {Object} options
   * @param {Boolean} [options.sourceMaps=false] Whether to run the build with sourcemaps
   * @param {Boolean} [options.noJSONChecks=false] Whether to run without checking the json
   * @param {Boolean} [options.noCache=false] Whether to clear build caches
   * @param {String} [options.cwd=process.cwd()] Root path of the framework installation
   * @param {String} [options.outputDir="build/"] Root path of the framework installation
   * @param {String} [options.cachePath="build/.cache"] Path of compilation cache file
   * @return {Promise}
   */
  async buildCourse ({
    sourceMaps = false,
    noJSONChecks = false,
    noCache = false,
    cwd = process.cwd(),
    outputDir = './build/',
    cachePath = './build/.cache'
  } = {}) {
    await build({
      sourceMaps,
      noJSONChecks,
      noCache,
      cwd,
      outputDir,
      cachePath
    })
  }

  /**
   * Installs multiple plugins
   * Can install from zip, source folder or bower registry
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An array with name@version or name@path strings
   * @param {String} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise}
   */
  async installPlugins ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    await install({
      plugins,
      isInteractive: false,
      cwd
    })
  }

  /**
   * Uninstalls multiple plugins
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An array with name@version or name@path strings
   * @param {String} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise}
   */
  async uninstallPlugins ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    await uninstall({
      plugins,
      isInteractive: false,
      cwd
    })
  }

  /**
   * Updates multiple plugins
   * Can install from zip, source folder or bower registry
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An array with name@version or name@path strings
   * @param {String} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise}
   */
  async updatePlugins ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    await update({
      plugins,
      isInteractive: false,
      cwd
    })
  }

  /**
   * Retrieves all schemas defined in the project
   * Clears schema cache
   * @param {String} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise} Resolves with array of JSON schema filepaths
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
   * @param {String} options.name Schema filepath as returned from getSchemaPaths
   * @return {Promise} Resolves with the JSON schema contents
   */
  async getSchema ({
    name
  } = {}) {
    if (!this._schemaPaths) return new Error('Please run get schema paths first')
    if (!fs.existsSync(name) || !this._schemaPaths.includes(name)) throw new Error(`Schema does not exist: ${name}`)
    return (this._schemas[name] = this._schemas[name] ?? await fs.readJSON(name))
  }

  /**
   * Gets the update information for installed plugins
   * @param {Object} options
   * @param {[string]} [options.plugins=null] An arrat of plugin names (if not specified, all plugins are checked)
   * @param {String} [options.cwd=process.cwd()] Root path of the framework installation
   * @return {Promise<[Plugin]>} Resolves plugin update info
   */
  async getPluginUpdateInfos ({
    plugins = null,
    cwd = process.cwd()
  } = {}) {
    /** @type {Project} */
    const project = new Project({ cwd })
    if (!project.isAdaptDirectory) throw new Error(`No in an adapt folder at: ${cwd}`)
    const frameworkVersion = project.version
    /** @type {[Plugin]} */
    const installedPlugins = await project.getInstalledPlugins()
    const filteredPlugins = !plugins?.length
      ? installedPlugins
      : plugins.map(name => {
        // TODO: api.getUpdateInfos filter by plugins variable
      })
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

// TEMPORARY: api http server, to hold open process for testing
const a = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('test', 'utf-8')
})
a.listen(999)
// TEMPORARY: make api global to debug more easily
global.api = api
