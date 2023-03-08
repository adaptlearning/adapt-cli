
import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import fs from 'fs-extra'
import path from 'path'
import bower from 'bower'
import fetch from 'node-fetch'
import chalk from 'chalk'
import inquirer from 'inquirer'
import globs from 'globs'
import { readValidateJSON } from '../../util/JSONReadValidate.js'
import Plugin from '../Plugin.js'
import semver from 'semver'
import { ADAPT_ALLOW_PRERELEASE } from '../../util/constants.js'
import { searchInfo, isNPM } from '../PluginManagement/npm.js'
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

export default async function register ({
  logger,
  cwd = process.cwd()
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)

  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  logger?.warn('Using registry at', BOWER_REGISTRY_CONFIG.register)
  try {
    const pluginJSONPath = await Promise((resolve, reject) => {
      globs(['package.json', 'bower.json'], { cwd }, (err, matches) => {
        if (err) return reject(err)
        resolve(matches?.[0])
      })
    })
    const hasPluginJSON = fs.existsSync(pluginJSONPath)

    const pluginJSON = {
      name: undefined,
      repository: undefined,
      framework: undefined,
      ...(hasPluginJSON ? await readValidateJSON(pluginJSONPath) : {})
    }
    const properties = await confirm(pluginJSON)
    hasPluginJSON && await fs.writeJSON(pluginJSONPath, properties, { spaces: 2, replacer: null })

    // given a package name, create two Plugin representations
    // if supplied name is adapt-contrib-myPackageName do a check against this name only
    // if suppled name is adapt-myPackageName check against this name and adapt-contrib-myPackageName
    // becase we don't want to allow adapt-myPackageName if adapt-contrib-myPackageName exists
    const plugin = new Plugin({ name: properties.name, logger })
    const contribPlugin = new Plugin({ name: properties.name, isContrib: true, logger })
    const contribExists = await exists({ cwd, BOWER_REGISTRY_CONFIG, pluginName: contribPlugin })
    const pluginExists = await exists({ cwd, BOWER_REGISTRY_CONFIG, pluginName: plugin })

    if (contribExists || pluginExists) {
      logger?.warn(plugin.toString(), 'has been previously registered. Plugin names must be unique. Try again with a different name.')
      return
    }

    const result = await registerWithBowerRepo(BOWER_REGISTRY_CONFIG, plugin, properties.repository)
    if (!result) throw new Error('The plugin was unable to register.')
    logger?.log(chalk.green(plugin.packageName), 'has been registered successfully.')
  } catch (err) {
    logger?.error(err)
  }
}

async function confirm (properties) {
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
        return /https:\/\/([\w.@:/\-~]+)(\.git)(\/)?/.test(v) ||
            'Please provide a repository URL of the form https://<domain><path>.git'
      },
      type: 'input',
      default: properties.repository ? properties.repository.url : undefined
    },
    {
      name: 'framework',
      message: chalk.cyan('framework'),
      validate: v => {
        return semver.validRange(v, semverOptions) !== null ||
            'Please provide a valid semver (see https://semver.org/)'
      },
      type: 'input',
      default: properties.framework || '>=5.15'
    },
    {
      name: 'ready',
      message: chalk.cyan('Register now?'),
      type: 'confirm',
      default: true
    }
  ]
  const confirmation = await inquirer.prompt(schema)
  if (!confirmation.ready) throw new Error('Aborted. Nothing has been registered.')
  properties.name = confirmation.name
  properties.repository = { type: 'git', url: confirmation.repositoryUrl }
  properties.framework = confirmation.framework
  return properties
}

/**
 * @param {Plugin} plugin
 * @returns {boolean}
 */
async function exists ({ cwd, BOWER_REGISTRY_CONFIG, pluginName }) {
  pluginName = pluginName.toString().toLowerCase()
  if (await isNPM()) {
    return await searchInfo({
      cwd,
      registry: BOWER_REGISTRY_CONFIG.register,
      term: pluginName
    })
  }
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

async function registerWithBowerRepo ({ cwd, BOWER_REGISTRY_CONFIG, plugin, repository }) {
  if (await isNPM()) {
    const path = 'packages'
    const response = await fetch(BOWER_REGISTRY_CONFIG.register + path, {
      method: 'POST',
      headers: { 'User-Agent': 'adapt-cli' },
      data: {
        name: plugin.toString(),
        url: repository
      },
      followRedirect: false
    })
    if (response.status === 201) return true
    throw new Error(`The server responded with ${response.status}`)
  }
  return new Promise((resolve, reject) => {
    bower.commands.register(plugin.toString(), repository.url || repository, {
      registry: BOWER_REGISTRY_CONFIG
    })
      .on('end', resolve)
      .on('error', reject)
  })
}
