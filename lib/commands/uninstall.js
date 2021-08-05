import Cwd from '../Cwd.js'
import {
  DEFAULT_PROJECT_MANIFEST_PATH,
  DEFAULT_PROJECT_FRAMEWORK_PATH,
  BOWER_REGISTRY_URL
} from '../CONSTANTS.js'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import Q from 'q'
import PluginTypeResolver from '../PluginTypeResolver.js'
import { getKeywords } from '../PackageMeta.js'
import Project from '../Project.js'
import Plugin from '../Plugin.js'
import { reportFailure, reportInvalidFrameworkDirectory } from '../RendererHelpers.js'
import uninstallPackage from '../promise/uninstallPackage.js'
import Errors from '../errors.js'

export function api (pluginName, cwd) {
  Cwd(cwd)

  const project = new Project(DEFAULT_PROJECT_MANIFEST_PATH(), DEFAULT_PROJECT_FRAMEWORK_PATH())

  if (!project.isProjectContainsManifestFile()) {
    return Q.reject(Errors.ERROR_COURSE_DIR)
  }

  const plugin = Plugin.parse(pluginName)
  const deferred = Q.defer()

  getKeywords(plugin, { registry: BOWER_REGISTRY_URL })
    .then(function (keywords) {
      const resolver = new PluginTypeResolver()
      const pluginType = resolver.resolve(keywords)

      return uninstallPackage(plugin, {
        directory: path.join('src', pluginType.belongsTo),
        cwd: Cwd()
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
        const pluginPath = path.join(Cwd(), 'src', pluginType, plugin.packageName)

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

  const project = new Project(DEFAULT_PROJECT_MANIFEST_PATH())
  if (!project.isProjectContainsManifestFile()) {
    return reportInvalidFrameworkDirectory(renderer)
  }

  const plugin = Plugin.parse(packageName)

  getKeywords(plugin, { registry: BOWER_REGISTRY_URL })
    .then(function (keywords) {
      const resolver = new PluginTypeResolver()
      const pluginType = resolver.resolve(keywords)

      renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Uninstalling', pluginType.typename, '...')
      return uninstallPackage(plugin, {
        directory: path.join('src', pluginType.belongsTo),
        cwd: Cwd()
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
        const pluginPath = path.join(Cwd(), 'src', pluginType, plugin.packageName)

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
