import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import Q from 'q'
// import PluginTypeResolver from '../integration/PluginTypeResolver.js'
// import { getPluginKeywords } from '../integration/PackageManagement.js'
import Project from '../integration/Project.js'
import Plugin from '../integration/Plugin.js'
import { reportFailure, reportInvalidFrameworkDirectory } from '../util/RendererHelpers.js'
import Errors from '../util/errors.js'
import bower from 'bower'

function uninstallPackage (plugin, config) {
  const deferred = Q.defer()

  bower.commands.uninstall([plugin.toString()], {}, config)
    .on('end', function (uninstalled) {
      Object.prototype.hasOwnProperty.call(uninstalled, plugin.toString()) ? deferred.resolve() : deferred.reject()
    })
    .on('error', function (err) {
      deferred.reject(err)
    })
  return deferred.promise
}

export function api (pluginName, cwd) {
  process.chdir(cwd)

  const project = new Project()

  if (!project.isProjectContainsManifestFile()) {
    return Q.reject(Errors.ERROR_COURSE_DIR)
  }

  const plugin = Plugin.parse(pluginName)
  const deferred = Q.defer()

  getPluginKeywords(plugin)
    .then(function (keywords) {
      const resolver = new PluginTypeResolver()
      const pluginType = resolver.resolve(keywords)

      return uninstallPackage(plugin, {
        directory: path.join('src', pluginType.belongsTo),
        cwd: process.cwd()
      })
    })
    .then(function () {
      project.remove(plugin)
    })
    .then(function () {
      deferred.resolve(pluginName)
    })
    .fail(function () {
    // will fail if plugin has not been installed by Bower (i.e. the .bower.json manifest is missing)
    // so just try and remove the directory (this is basically what Bower does anyway)

      let removePath;

      ['components', 'extensions', 'menu', 'theme'].forEach(function (pluginType) {
        const pluginPath = path.join(process.cwd(), 'src', pluginType, plugin.packageName)

        if (fs.existsSync(pluginPath)) {
          removePath = pluginPath
        }
      })

      if (removePath) {
        rimraf(removePath, function () {
          if (fs.existsSync(removePath)) {
            deferred.reject(Errors.ERROR_UNINSTALL)
          } else {
            project.remove(plugin)
            deferred.resolve(pluginName)
          }
        })
      } else {
        deferred.reject(Errors.ERROR_NOT_FOUND)
      }
    })

  return deferred.promise
}

export default function uninstall (renderer) {
  const packageName = arguments.length >= 3 ? arguments[1] : null
  const done = arguments[arguments.length - 1]

  if (!packageName) {
    return renderer.log(chalk.red('Please specify a plugin to uninstall.'))
  }

  const project = new Project()
  if (!project.isProjectContainsManifestFile()) {
    return reportInvalidFrameworkDirectory(renderer)
  }

  const plugin = Plugin.parse(packageName)

  getPluginKeywords(plugin)
    .then(function (keywords) {
      const resolver = new PluginTypeResolver()
      const pluginType = resolver.resolve(keywords)

      renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Uninstalling', pluginType.typename, '...')
      return uninstallPackage(plugin, {
        directory: path.join('src', pluginType.belongsTo),
        cwd: process.cwd()
      })
    })
    .then(function () {
      project.remove(plugin)
    })
    .then(function () {
      done()
    })
    .fail(function () {
    // will fail if plugin has not been installed by Bower (i.e. the .bower.json manifest is missing)
    // so just try and remove the directory (this is basically what Bower does anyway)

      let removePath;

      ['components', 'extensions', 'menu', 'theme'].forEach(function (pluginType) {
        const pluginPath = path.join(process.cwd(), 'src', pluginType, plugin.packageName)

        if (fs.existsSync(pluginPath)) {
          removePath = pluginPath
        }
      })

      if (removePath) {
        rimraf(removePath, function () {
          if (fs.existsSync(removePath)) {
            reportFailure(renderer)
          } else {
            project.remove(plugin)
            done()
          }
        })
      } else {
        reportFailure(renderer)
      }
    })
}
