import fs from 'fs-extra'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import Q from 'q'
import { readValidateJSON } from '../util/JSONReadValidate.js'
// import { BOWER_REGISTRY_URL, authenticate } from '../integration/PackageManagement.js'
let log

export default function unregister (renderer) {
  log = renderer.log

  const done = arguments[arguments.length - 1] || function () {}
  let pluginName

  if (arguments.length >= 3) {
    pluginName = arguments[1]
  }

  log(chalk.yellow('This will unregister the plugin at', BOWER_REGISTRY_URL))

  getProperties(pluginName)
    .then(authenticate)
    .then(confirm)
    .then(unregisterInBowerRepo)
    .then(function () {
      log(chalk.green('The plugin was successfully unregistered.'))
      done()
    })
    .catch(function (err) {
      log(chalk.red(err))
      log('The plugin was not unregistered.')
      done(err)
    })
    .done()
}

function getProperties (pluginName) {
  if (pluginName) {
    return Q.resolve({ name: pluginName })
  }

  return loadPluginProperties('./bower.json')
}

function loadPluginProperties (path, defaults) {
  const deferred = Q.defer()

  path = path || './bower.json'

  if (!fs.existsSync(path)) {
    deferred.reject(new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.'))
  }
  readValidateJSON(path, function (data) {
    deferred.resolve(Object.assign({}, defaults, data))
  })

  return deferred.promise
}

function confirm (properties) {
  const deferred = Q.defer()
  const schema = [
    {
      name: 'ready',
      message: chalk.cyan('Confirm Unregister now?'),
      type: 'confirm',
      default: true
    }
  ]
  inquirer.prompt(schema).then(confirmation => {
    if (!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been unregistered.'))
    deferred.resolve(properties)
  }).catch(err => deferred.reject(err))
  return deferred.promise
}

function unregisterInBowerRepo (properties) {
  const deferred = Q.defer()

  // user (username) with OAuth (token) wants to unregister the registered plugin (name) from registry
  bower.commands.unregister(properties.username + '/' + properties.name, {
    token: properties.token,
    registry: BOWER_REGISTRY_URL
  })
    .on('end', function (result) {
    // log('end', result);
      deferred.resolve()
    })
    .on('error', function (err) {
    // log('error', err);
      deferred.reject(err)
    })
  return deferred.promise
}
