import { getBowerRegistry } from '../integration/PluginManagement.js'
import authenticate from './autenticate.js'
import fs from 'fs-extra'
import path from 'path'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { readValidateJSON } from '../util/JSONReadValidate.js'
import Project from '../integration/Project.js'

export default async function unregister ({
  logger,
  localDir,
  pluginName
}) {
  const project = new Project({ logger })
  const BOWER_REGISTRY_URL = getBowerRegistry(project)
  logger?.log(chalk.yellow('This will unregister the plugin at', BOWER_REGISTRY_URL))
  try {
    const bowerJSONPath = path.join(localDir, 'bower.json')
    if (!fs.existsSync(bowerJSONPath)) {
      throw new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.')
    }
    const bowerJSON = await readValidateJSON(bowerJSONPath)
    if (!pluginName) pluginName = bowerJSON.name
    const repository = bowerJSON.repository
    const { username, token } = authenticate({ repository })
    await confirm()
    unregisterInBowerRepo({ pluginName, username, token, BOWER_REGISTRY_URL })
    logger?.log(chalk.green('The plugin was successfully unregistered.'))
  } catch (err) {
    logger?.log(chalk.red(err))
    logger?.log('The plugin was not unregistered.')
  }
}

async function confirm () {
  const schema = [
    {
      name: 'ready',
      message: chalk.cyan('Confirm Unregister now?'),
      type: 'confirm',
      default: true
    }
  ]
  const confirmation = await inquirer.prompt(schema)
  if (!confirmation.ready) throw new Error('Aborted. Nothing has been unregistered.')
}

async function unregisterInBowerRepo ({
  pluginName,
  username,
  token,
  BOWER_REGISTRY_URL
}) {
  return new Promise((resolve, reject) => {
    // user (username) with OAuth (token) wants to unregister the registered plugin (pluginName) from registry
    bower.commands.unregister(username + '/' + pluginName, {
      token: token,
      registry: BOWER_REGISTRY_URL
    })
      .on('end', resolve)
      .on('error', reject)
  })
}
