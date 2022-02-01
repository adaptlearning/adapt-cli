import http from 'http' // TEMPORARY: api http import, to hold open process for testing
import { ADAPT_FRAMEWORK } from './util/constants.js'
import {
  build,
  download,
  erase,
  getLatestVersion,
  npmInstall
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

// MAIN: api, no interactivity, good errors

class API {
  /**
   * Installs a clean copy of the framework
   * @param {object} options
   * @param {String} options.version Specific version of the framework to install
   * @param {String} [options.repository] URL to github repo
   * @param {String} [options.dir] Directory to install into
   * @return {Promise}
   */
  async installFramework ({
    version = null,
    repository = ADAPT_FRAMEWORK,
    cwd = process.cwd(),
    progress = percent => {}
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
    await npmInstall({
      cwd
    })
  }

  /**
   * Runs the build for a current course
   * @param {Object} options
   * @param {Boolean} [options.devMode=false] Whether to run the build in developer mode
   * @param {Boolean} [options.forceRebuild=false] Whether to clear build caches first
   * @param {String} [options.cwd] Root path of the framework installation
   * @param {String} [options.outputDir="build/"] Root path of the framework installation
   * @param {String} [options.cachePath="build/.cache"] Path of compilation cache file
   * @return {Promise}
   */
  async buildCourse ({
    devMode = false,
    forceRebuild = false,
    cwd = process.cwd(),
    outputDir = null,
    cachePath = null,
    progress = percent => {}
  } = {}) {
    await build({
      dev: devMode,
      forceRebuild,
      cwd,
      outputDir,
      cachePath
    })
  }

  /**
   * Installs a single framework plugin
   * @param {Object} options
   * @param {String} options.plugins Name of plugin (with optional version, e.g. @4.0.0 - defaults to the latest supported)
   * @param {String} [options.cwd] Root path of the framework installation
   * @return {Promise} Resolves with the plugin's parsed bower JSON
   */
  async installPlugins ({
    plugins,
    cwd = process.cwd(),
    progress = percent => {}
  } = {}) {
    // MAIN: api.installPlugins
    // custom plugin? path to zip / dir source?
    // cli > bower > github > src/[plugintype]
    // pluginZip > att > src/[pluginType]
    // sourceDir as an alternative to bower/github repo url, works with npm and bower and aat zip uploads

    // do not update manifest
  }

  /**
   * Removes a single framework plugin
   * @param {Object} options
   * @param {String} options.plugins Name of plugin
   * @param {String} [options.cwd] Root path of the framework installation
   * @return {Promise}
   */
  async uninstallPlugins ({
    plugins,
    cwd = process.cwd(),
    progress = percent => {}
  } = {}) {
    // do not update manifest
    // MAIN: api.uninstallPlugins
  }

  /**
   * Updates a single framework plugin
   * @param {Object} options
   * @param {String} options.plugins Name of plugin (with optional version, e.g. @4.0.0 - defaults to the latest supported)
   * @param {String} [options.cwd] Root path of the framework installation
   * @return {Promise} Resolves with the plugin's parsed bower JSON
   */
  async updatePlugins ({
    plugins,
    cwd = process.cwd(),
    progress = percent => {}
  } = {}) {
    // do not update manifest
    // MAIN: api.updatePlugins
  }

  /**
   * Retrieves all schema defined in the framework
   * @param {String} [options.cwd] Root path of the framework installation
   * @return {Promise} Resolves with array of JSON schema filepath and contents
   */
  async getSchemaPaths ({ cwd = process.cwd() } = {}) {
    this._schemaPaths = await schemas({ cwd })
    this._schemas = {}
    return this._schemaPaths
  }

  /**
   * Retrieves named schema
   * @param {String} options.name Schema name
   * @return {Promise} Resolves with the JSON schema contents
   */
  async getSchema ({ name } = {}) {
    if (!this._schemaPaths) return new Error('Please run get schema paths first')
    if (!fs.existsSync(name) || !this._schemaPaths.includes(name)) throw new Error(`Schema does not exist: ${name}`)
    return (this._schemas[name] = this._schemas[name] ?? await fs.readJSON(name))
  }

  /**
   * Gets the update information for installed framework/plugins
   * @param {Object} options
   * @param {String} options.pluginName Name of plugin (if not specified, all plugins are checked), should also accept 'adapt_framework'
   * @param {String} [options.cwd] Root path of the framework installation
   * @return {Promise} Resolves with array/object with plugin update info (see below)
   */
  async getUpdateInfos ({
    plugins,
    cwd = process.cwd(),
    progress = percent => {}
  } = {}) {
    /** @type {Project} */
    const project = new Project({ cwd })
    if (!project.isAdaptDirectory) throw new Error(`No in an adapt folder at: ${cwd}`)
    const frameworkVersion = project.version
    /** @type {[Plugin]} */
    const instances = await project.getUpdateTargets()
    // TODO: api.getUpdateInfos filter by plugins variable
    // TODO: add progress function
    await async.eachOfLimit(instances, 8, async plugin => {
      await plugin.fetchProjectInfo()
      await plugin.fetchBowerInfo()
      await plugin.findCompatibleVersion(frameworkVersion)
      // TODO: add progress function
    })
    return instances.map(plugin => {
      return {
        name: plugin.packageName,
        isLocalSource: plugin.isLocalSource,
        latestCompatibleVersion: plugin.latestCompatibleSourceVersion,
        latestVersion: plugin.latestSourceVersion || plugin.projectVersion,
        version: plugin.projectVersion
      }
    })
  }

  async getPluginFromPath ({
    pluginPath,
    cwd = null
  } = {}) {
    const project = cwd ? new Project({ cwd }) : null
    return Plugin.fromPath({ pluginPath, project })
  }

  /** @deprecated */
  getApi () {
    throw new Error('Cannot export API using getAPI, please use it directly')
  }
}

const api = new API()
global.api = api
export default api

// TEMPORARY: api http server, to hold open process for testing
const a = http.createServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('test', 'utf-8');
})
a.listen(999)
