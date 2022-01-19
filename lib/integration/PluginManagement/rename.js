import getBowerRegistryConfig from './getBowerRegistryConfig.js'
import authenticate from './autenticate.js'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import request from 'request'
import Plugin from '../Plugin.js'
import Project from '../Project.js'

export default async function rename ({
  logger,
  oldName,
  newName
}) {
  const project = new Project({ logger })
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig(project)
  if (!oldName || !newName) {
    logger?.log(chalk.red('You must call rename with the following arguments: <plugin name> <new plugin name>'))
    return
  }
  // use Plugin to standardise name
  newName = new Plugin({ name: newName }).packageName
  oldName = new Plugin({ name: oldName }).packageName
  logger?.log(chalk.yellow('Using registry at', BOWER_REGISTRY_CONFIG.register))
  logger?.log(chalk.yellow(`Plugin will be renamed from ${oldName} to ${newName}`))
  try {
    const oldExists = await exists(BOWER_REGISTRY_CONFIG, oldName)
    if (!oldExists) throw new Error(`Plugin "${oldName}" does not exist`)
    const newExists = await exists(BOWER_REGISTRY_CONFIG, newName)
    if (newExists) throw new Error(`Name "${newName}" already exists`)
    const { username, token, type } = await authenticate({ pluginName: oldName })
    logger?.log(`${username} authenticated as ${type}`)
    await confirm()
    await renameInBowerRepo({
      username,
      token,
      oldName,
      newName,
      BOWER_REGISTRY_CONFIG
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
  BOWER_REGISTRY_CONFIG
}) {
  const path = 'packages/rename/' + username + '/' + oldName + '/' + newName
  const query = '?access_token=' + token
  return new Promise((resolve, reject) => {
    request({
      url: BOWER_REGISTRY_CONFIG.register + path + query,
      method: 'GET',
      headers: { 'User-Agent': 'adapt-cli' },
      followRedirect: false
    }, (err, res) => {
      if (err) return reject(err)
      if (res.statusCode !== 201) reject(new Error(`The server responded with ${res.statusCode}`))
      resolve()
    })
  })
}

async function exists (BOWER_REGISTRY_CONFIG, plugin) {
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
      registry: BOWER_REGISTRY_CONFIG.register
    })
      .on('end', function (result) {
        const matches = result.filter(exactMatch(plugin.toString()))
        resolve(Boolean(matches.length))
      })
      .on('error', reject)
  })
}
