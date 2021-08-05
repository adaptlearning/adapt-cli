import {
  BOWER_REGISTRY_URL
} from '../CONSTANTS.js'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import Q from 'q'
import request from 'request'
import Plugin from '../Plugin.js'
import authenticate from '../promise/authenticate.js'
let log

export default function rename (renderer) {
  log = renderer.log

  const done = arguments[arguments.length - 1] || function () {}

  if (arguments.length >= 4) {
    const params = {
      oldName: arguments[1],
      newName: arguments[2]
    }

    // use Plugin to standardise name
    params.newName = new Plugin(params.newName).packageName

    log(chalk.yellow('Using registry at', BOWER_REGISTRY_URL))
    log(chalk.yellow('Plugin will be renamed to', params.newName))

    Q(params)
      .then(checkPluginNameExists)
      .then(checkNewPluginNameDoesNotExist)
      .then(authenticate)
      .then(confirm)
      .then(renameInBowerRepo)
      .then(function () {
        log(chalk.green('The plugin was successfully renamed.'))
        done()
      })
      .catch(function (err) {
        log(chalk.red(err))
        log('The plugin was not renamed.')
        done(err)
      })
      .done()
  } else {
    log(chalk.red('You must call rename with the following arguments: <plugin name> <new plugin name>'))
    done()
  }
}

function checkPluginNameExists (params) {
  return exists(params.oldName).then(function (exists) {
    return exists ? Q.resolve(params) : Q.reject('Plugin "' + params.oldName + '" does not exist')
  })
}

function checkNewPluginNameDoesNotExist (params) {
  return exists(params.newName).then(function (exists) {
    return exists ? Q.reject('Name "' + params.newName + '" already exists') : Q.resolve(params)
  })
}

function confirm (params) {
  const deferred = Q.defer()
  const schema = [
    {
      name: 'ready',
      message: chalk.cyan('Confirm rename now?'),
      type: 'confirm',
      default: true
    }
  ]
  inquirer.prompt(schema).then(confirmation => {
    if (!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been renamed.'))
    deferred.resolve(params)
  }).catch(err => deferred.reject(err))
  return deferred.promise
}

function renameInBowerRepo (params) {
  const deferred = Q.defer()
  const path = 'packages/rename/' + params.username + '/' + params.oldName + '/' + params.newName
  const query = '?access_token=' + params.token

  request({
    url: BOWER_REGISTRY_URL + '/' + path + query,
    method: 'GET',
    headers: { 'User-Agent': 'adapt-cli' },
    followRedirect: false
  }, function (err, res, body) {
    if (err) {
      deferred.reject(err)
    } else {
      res.statusCode === 201 ? deferred.resolve(params) : deferred.reject('The server responded with ' + res.statusCode)
    }
  })

  return deferred.promise
}

function exists (plugin) {
  const deferred = Q.defer()

  bower.commands.search(plugin.toString(), { registry: BOWER_REGISTRY_URL })
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
