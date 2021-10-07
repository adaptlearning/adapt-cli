
// import {
//   BOWER_REGISTRY_URL
// } from '../integration/PackageManagement.js'
import fs from 'fs-extra'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import Q from 'q'
import { readValidateJSON } from '../util/JSONReadValidate.js'
import Plugin from '../integration/Plugin.js'
import semver from 'semver'

export default function register (logger) {
  const done = arguments[arguments.length - 1] || function () {}

  // logger?.log(chalk.yellow('This will publish this plugin to', BOWER_REGISTRY_URL));

  loadPluginProperties('./bower.json', {
    name: undefined,
    repository: undefined,
    framework: undefined
  })
    .then(confirm)
    .then(function (properties) {
      savePluginProperties('./bower.json', properties)
      return properties
    })
    .then(function (properties) {
    // given a package name, create two Plugin representations
    // if supplied name is adapt-contrib-myPackageName do a check against this name only
    // if suppled name is adapt-myPackageName check against this name and adapt-contrib-myPackageName
    // becase we don't want to allow adapt-myPackageName if adapt-contrib-myPackageName exists
      const plugin = new Plugin({ name: properties.name })
      const contribPlugin = new Plugin({ name: properties.name, isContrib: true })
      const searches = [exists(contribPlugin)]

      if (!plugin.isContrib) {
        searches.push(exists(plugin))
      }

      return Q.all(searches)
        .spread(function (contribExists, pluginExists) {
          if (contribExists) {
            return reportExistence(contribPlugin, logger)
          }
          if (pluginExists) {
            return reportExistence(plugin, logger)
          }
          return registerWithBowerRepo(plugin, properties.repository)
        })
    })
    .then(function (registered) {
      if (!registered.result) throw new Error('The plugin was unable to register.')
      logger?.log(chalk.green(registered.plugin.packageName), 'has been registered successfully.')
      done()
    })
    .fail(function (err) {
      logger?.log(chalk.red(err))
      done(err)
    })
    .done()
}

function loadPluginProperties (path, defaults) {
  const deferred = Q.defer()

  path = path || './bower.json'

  if (!fs.existsSync(path)) {
    deferred.reject(new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.'))
  }
  readValidateJSON(path, function (error, data) {
    if (error) {
      deferred.reject(new Error(error))
    } else {
      deferred.resolve(Object.assign({}, defaults, data))
    }
  })

  return deferred.promise
}

async function savePluginProperties (path, values) {
  path = path || './bower.json'
  if (!fs.existsSync(path)) {
    throw new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.')
  }
  return fs.writeJSON(path, values, { spaces: 2, replacer: null })
}

function confirm (properties) {
  const deferred = Q.defer()
  const plugin = new Plugin({ name: properties.name })
  const schema = [
    {
      name: 'name',
      message: chalk.cyan('name'),
      validate: v => {
        return /^adapt-[\w|-]+?$/.test(v) ||
            'Name must prefixed with \'adapt\' and each word separated with a hyphen(-)'
      },
      type: 'input',
      default: plugin.toString() || 'not specified'
    },
    {
      name: 'repositoryUrl',
      message: chalk.cyan('repository URL'),
      validate: v => {
        return /git:\/\/([\w.@:/\-~]+)(\.git)(\/)?/.test(v) ||
            'Please provide a repository URL of the form git://<domain><path>.git'
      },
      type: 'input',
      default: properties.repository ? properties.repository.url : undefined
    },
    {
      name: 'framework',
      message: chalk.cyan('framework'),
      validate: v => {
        return semver.validRange(v) !== null ||
            'Please provide a valid semver (see https://semver.org/)'
      },
      type: 'input',
      default: properties.framework || '~2.0.0'
    },
    {
      name: 'ready',
      message: chalk.cyan('Register now?'),
      type: 'confirm',
      default: true
    }
  ]
  inquirer.prompt(schema).then(confirmation => {
    if (!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been registered.'))

    properties.name = confirmation.name
    properties.repository = { type: 'git', url: confirmation.repositoryUrl }
    properties.framework = confirmation.framework

    deferred.resolve(properties)
  }).catch(err => deferred.reject(err))
  return deferred.promise
}

function registerWithBowerRepo (plugin, repository) {
  const deferred = Q.defer()

  bower.commands.register(plugin.toString(), repository.url || repository, {
    registry: BOWER_REGISTRY_URL
  })
    .on('end', function (result) {
      deferred.resolve({ result: result, plugin: plugin })
    })
    .on('error', function (err) {
      deferred.reject(err)
    })
  return deferred.promise
}

function exists (plugin) {
  const deferred = Q.defer()

  bower.commands.search(plugin.toString(), {
    registry: BOWER_REGISTRY_URL
  })
    .on('end', function (result) {
      const matches = result.filter(exactMatch(plugin.toString()))
      deferred.resolve(!!matches.length)
    })
    .on('error', function (err) {
      deferred.reject(err)
    })
  return deferred.promise
}

function exactMatch (pattern) {
  return function (item) {
    if (typeof pattern === 'string') {
      if (pattern.toLowerCase() === item.name.toLowerCase()) {
        return true
      }
      return false
    }
    const regexp = new RegExp(pattern, 'i')
    return regexp.test(item.name)
  }
}

function reportExistence (plugin, logger) {
  logger?.log(chalk.yellow(plugin.toString()), chalk.cyan('has been previously registered. Plugin names must be unique. Try again with a different name.'))
}
