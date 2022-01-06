import { getBowerRegistry } from '../integration/PluginManagement.js'
import authenticate from './autenticate.js'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import request from 'request'
import Plugin from '../integration/Plugin.js'
import Project from '../Project.js'

export default async function rename ({
  logger,
  oldName,
  newName
}) {
  const project = new Project({ logger })
  const BOWER_REGISTRY_URL = getBowerRegistry(project)
  if (!oldName || !newName) {
    logger?.log(chalk.red('You must call rename with the following arguments: <plugin name> <new plugin name>'))
    return
  }
  // use Plugin to standardise name
  newName = new Plugin({ name: newName }).packageName
  oldName = new Plugin({ name: oldName }).packageName
  logger?.log(chalk.yellow('Using registry at', BOWER_REGISTRY_URL))
  logger?.log(chalk.yellow('Plugin will be renamed to', newName))
  try {
    const oldExists = await exists(BOWER_REGISTRY_URL, oldName)
    if (!oldExists) throw new Error(`Plugin "${oldName}" does not exist`)
    const newExists = await exists(BOWER_REGISTRY_URL, newName)
    if (!newExists) throw new Error(`Name "${newName}" already exists`)
    const { username, token } = await authenticate()
    await confirm()
    await renameInBowerRepo({
      username,
      token,
      oldName,
      newName,
      BOWER_REGISTRY_URL
    })
    logger?.log(chalk.green('The plugin was successfully renamed.'))
  } catch (err) {
    logger?.log(chalk.red(err))
    logger?.log('The plugin was not renamed.')
  }
}

async function confirm () {
  const schema = [
    {
      name: 'ready',
      message: chalk.cyan('Confirm rename now?'),
      type: 'confirm',
      default: true
    }
  ]
  const confirmation = await inquirer.prompt(schema)
  if (!confirmation.ready) throw new Error('Aborted. Nothing has been renamed.')
}

async function renameInBowerRepo ({
  username,
  token,
  oldName,
  newName,
  BOWER_REGISTRY_URL
}) {
  const path = 'packages/rename/' + username + '/' + oldName + '/' + newName
  const query = '?access_token=' + token
  return new Promise((resolve, reject) => {
    request({
      url: BOWER_REGISTRY_URL + '/' + path + query,
      method: 'GET',
      headers: { 'User-Agent': 'adapt-cli' },
      followRedirect: false
    }, function (err, res, body) {
      if (err) return reject(err)
      if (res.statusCode !== 201) reject(new Error(`The server responded with ${res.statusCode}`))
      resolve()
    })
  })
}

async function exists (BOWER_REGISTRY_URL, plugin) {
  function exactMatch (pattern) {
    return function (item) {
      if (typeof pattern === 'string') return (pattern.toLowerCase() === item.name.toLowerCase())
      // TODO: check that this regexp is never used
      const regexp = new RegExp(pattern, 'i')
      return regexp.test(item.name)
    }
  }
  return new Promise((resolve, reject) => {
    bower.commands.search(plugin.toString(), {
      registry: BOWER_REGISTRY_URL
    })
      .on('end', function (result) {
        const matches = result.filter(exactMatch(plugin.toString()))
        resolve(!!matches.length)
      })
      .on('error', reject)
  })
}
