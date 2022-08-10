import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import authenticate from './autenticate.js'
import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { readValidateJSON } from '../../util/JSONReadValidate.js'
import Plugin from '../Plugin.js'
import fetch from 'node-fetch'

export default async function unregister ({
  logger,
  cwd = process.cwd(),
  pluginName
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  logger?.warn('Using registry at', BOWER_REGISTRY_CONFIG.register)
  try {
    const bowerJSONPath = path.join(cwd, 'bower.json')
    const hasBowerJSON = fs.existsSync(bowerJSONPath)
    const bowerJSON = hasBowerJSON ? await readValidateJSON(bowerJSONPath) : {}
    if (pluginName) bowerJSON.name = pluginName
    const props = await confirm(bowerJSON)
    pluginName = props.pluginName
    const repository = props.repository
    const { username, token, type } = await authenticate({ repository, pluginName })
    logger?.log(`${username} authenticated as ${type}`)
    await finalConfirm()
    await unregisterInBowerRepo({ pluginName, username, token, BOWER_REGISTRY_CONFIG })
    logger?.log(chalk.green('The plugin was successfully unregistered.'))
  } catch (err) {
    logger?.error(err)
    logger?.log('The plugin was not unregistered.')
  }
}

async function confirm (properties) {
  const plugin = new Plugin({ name: properties.name })
  const schema = [
    {
      name: 'pluginName',
      message: chalk.cyan('name'),
      validate: v => {
        return /^adapt-[\w|-]+?$/.test(v) ||
            'Name must prefixed with \'adapt\' and each word separated with a hyphen(-)'
      },
      type: 'input',
      default: plugin.toString() || 'not specified'
    },
    {
      name: 'repository',
      message: chalk.cyan('repository URL'),
      validate: v => {
        return /https:\/\/([\w.@:/\-~]+)(\.git)(\/)?/.test(v) ||
            'Please provide a repository URL of the form https://<domain><path>.git'
      },
      type: 'input',
      default: properties.repository ? properties.repository.url : undefined
    }
  ]
  return await inquirer.prompt(schema)
}

async function finalConfirm () {
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
  BOWER_REGISTRY_CONFIG
}) {
  const uri = `${BOWER_REGISTRY_CONFIG.register}packages/${username}/${pluginName}?access_token=${token}`
  const response = await fetch(uri, {
    method: 'DELETE',
    headers: { 'User-Agent': 'adapt-cli' },
    followRedirect: false
  })
  if (response.status !== 204) throw new Error(`The server responded with ${response.status}`)
}
