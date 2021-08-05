import {
  DEFAULT_PROJECT_MANIFEST_PATH,
  DEFAULT_PROJECT_FRAMEWORK_PATH,
  BOWER_REGISTRY_URL,
  FRAMEWORK_REPOSITORY,
  FRAMEWORK_REPOSITORY_NAME
} from '../CONSTANTS.js'
import { exec } from 'child_process'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import PluginTypeResolver from '../PluginTypeResolver.js'
import { getKeywords } from '../PackageMeta.js'
import Project from '../Project.js'
import Plugin from '../Plugin.js'
import cloneInstall from '../promise/cloneInstall.js'

export default function () {
  function clonePlugins (localPath, renderer) {
    renderer.log('Cloning Plugins')

    const project = new Project(
      path.resolve(localPath, DEFAULT_PROJECT_MANIFEST_PATH()),
      path.resolve(localPath, DEFAULT_PROJECT_FRAMEWORK_PATH())
    )
    const plugins = project.plugins

    plugins.forEach(function (plugin, index, array) {
      createInstallationTask(plugin, localPath, renderer)
    })
  }

  function createInstallationTask (plugin, localPath, renderer) {
    return getKeywords(plugin, { registry: BOWER_REGISTRY_URL })
      .then(function (keywords) {
        const resolver = new PluginTypeResolver()
        const pluginType = resolver.resolve(keywords)

        renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...')
        return cloneInstall(plugin, {
          localPath: localPath,
          directory: path.join('src', pluginType.belongsTo),
          registry: BOWER_REGISTRY_URL
        })
      })
      .then(function (installed) {
        if (!installed) throw new Error('The plugin was found but failed to download and install.')
        renderer.log(chalk.green(plugin.packageName), 'has been installed successfully.')
      })
      .done()
  }

  return {
    devinstall: function (renderer) {
      const repository = arguments.length >= 3 ? arguments[1] : FRAMEWORK_REPOSITORY
      let localPath = path.resolve(FRAMEWORK_REPOSITORY_NAME)
      const done = arguments[arguments.length - 1] || function () {}

      try {
        // Are we inside an existing adapt_framework project.
        const packageJson = fs.readJSONSync(process.cwd() + '/package.json')
        if (packageJson.name === 'adapt_framework') {
          localPath = process.cwd()
        }
      } catch (err) {
        // Don't worry, we're not inside a framework directory.
      }

      // we're trying to install a single plugin.
      if (repository !== FRAMEWORK_REPOSITORY) {
        return createInstallationTask(Plugin.parse(repository), localPath, renderer)
      }

      function promiseFromChildProcess (child) {
        return new Promise(function (resolve, reject) {
          child.addListener('error', reject)
          child.addListener('exit', resolve)
        })
      }
      const child = exec(`git clone ${repository} "${localPath}"`)

      // clone the framework and all the bundled plugins.
      renderer.log('Cloning adapt_framework')
      promiseFromChildProcess(child)
        .then(function (repo) {
          renderer.log('Framework cloned.')
          process.chdir(localPath)
          clonePlugins(localPath, renderer, done)
        })
    }
  }
}
