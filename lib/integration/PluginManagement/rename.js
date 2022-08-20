import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import authenticate from './autenticate.js'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import path from 'path'
import Plugin from '../Plugin.js'

export default async function rename ({
  logger,
  oldName,
  newName,
  cwd = process.cwd()
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  if (!oldName || !newName) {
    logger?.error('You must call rename with the following arguments: <plugin name> <new plugin name>')
    return
  }
  // use Plugin to standardise name
  newName = new Plugin({ name: newName, logger }).packageName
  oldName = new Plugin({ name: oldName, logger }).packageName
  logger?.warn('Using registry at', BOWER_REGISTRY_CONFIG.register)
  logger?.warn(`Plugin will be renamed from ${oldName} to ${newName}`)
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
    logger?.error(err)
    logger?.error('The plugin was not renamed.')
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
  const response = await fetch(BOWER_REGISTRY_CONFIG.register + path + query, {
    method: 'GET',
    headers: { 'User-Agent': 'adapt-cli' },
    followRedirect: false
  })
  if (response.status !== 201) throw new Error(`The server responded with ${response.status}`)
}

/**
 * @param {Plugin} plugin
 * @returns {boolean}
 */
async function exists (BOWER_REGISTRY_CONFIG, plugin) {
  const pluginName = plugin.toString().toLowerCase()
  return new Promise((resolve, reject) => {
    bower.commands.search(pluginName, {
      registry: BOWER_REGISTRY_CONFIG.register
    })
      .on('end', result => {
        const matches = result.filter(({ name }) => name.toLowerCase() === pluginName)
        resolve(Boolean(matches.length))
      })
      .on('error', reject)
  })
}
