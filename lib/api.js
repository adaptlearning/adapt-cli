// Provided in CommonJS to give maximum compatibility
const build = import('./commands/build.js')
const create = import('./commands/create.js')
const devinstall = import('./commands/devinstall.js')
const help = import('./commands/help.js')
const install = import('./commands/install.js')
const ls = import('./commands/ls.js')
const register = import('./commands/register.js')
const rename = import('./commands/rename.js')
const search = import('./commands/search.js')
const uninstall = import('./commands/uninstall.js')
const unregister = import('./commands/unregister.js')
const update = import('./commands/update.js')
const version = import('./commands/version.js')

class API {
  /**
   * Installs a clean copy of the framework
   * @param {object} options
   * @param {String} options.version Specific version of the framework to install
   * @param {String} [options.dir] Directory to install into
   * @return {Promise}
   */
  async installFramework ({ version, dir = process.cwd() } = {}) {

  }

  /**
    * Updates the framework
    * @param {object} options
    * @param {String} options.version Specific version of the framework to install
    * @param {String} [options.dir] Root path of the framework installation
    * @return {Promise}
    */
  async updateFramework ({ version, dir = process.cwd() } = {}) {

  }

  /**
   * Runs the build for a current course
   * @param {Object} options
   * @param {String} [options.dir] Root path of the framework installation
   * @param {Boolean} options.devMode Whether to run the build in developer mode
   * @return {Promise}
   */
  async buildCourse ({ devMode = false, dir = process.cwd() } = {}) {

  }

  /**
   * Installs a single framework plugin
   * @param {Object} options
   * @param {String} options.plugin Name of plugin (with optional version, e.g. @4.0.0 - defaults to the latest supported)
   * @param {String} [options.dir] Root path of the framework installation
   * @return {Promise} Resolves with the plugin's parsed bower JSON
   */
  async installPlugin ({ plugin, dir = process.cwd() } = {}) {

  }

  /**
   * Removes a single framework plugin
   * @param {Object} options
   * @param {String} options.plugin Name of plugin
   * @param {String} [options.dir] Root path of the framework installation
   * @return {Promise}
   */
  async uninstallPlugin ({ plugin, dir = process.cwd() } = {}) {

  }

  /**
   * Updates a single framework plugin
   * @param {Object} options
   * @param {String} options.plugin Name of plugin (with optional version, e.g. @4.0.0 - defaults to the latest supported)
   * @param {String} [options.dir] Root path of the framework installation
   * @return {Promise} Resolves with the plugin's parsed bower JSON
   */
  async updatePlugin ({ plugin = '', dir = process.cwd() } = {}) {

  }

  /**
   * Retrieves all schema defined in the framework
   * @return {Promise} Resolves with array of JSON schema contents
   */
  async getSchemas () {

  }

  /**
   * Loads a single JSON schema file by name
   * @param {Object} options
   * @param {String} options.name Name of the schema to load
   * @return {Promise} Resolves with JSON schema contents
   */
  async getSchema ({ name } = {}) {

  }

  /**
   * Gets the update information for installed framework/plugins
   * @param {Object} options
   * @param {String} options.plugin Name of plugin (if not specified, all plugins are checked), should also accept 'adapt_framework'
   * @param {String} [options.dir] Root path of the framework installation
   * @return {Promise} Resolves with array/object with plugin update info (see below)
   */
  async getUpdateInfo ({ plugin, dir = process.cwd() } = {}) {

  }

  /** @deprecated */
  getApi () {
    throw new Error('Cannot export API using getAPI, please use it directly')
  }
}

module.exports = new API()
