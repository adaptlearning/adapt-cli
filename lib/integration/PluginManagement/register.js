
import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import fs from 'fs-extra'
import path from 'path'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { readValidateJSON } from '../../util/JSONReadValidate.js'
import Plugin from '../Plugin.js'
import semver from 'semver'
import { ADAPT_ALLOW_PRERELEASE } from '../../util/constants.js'
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

export default async function register ({
  logger,
  cwd = process.cwd()
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  logger?.warn('Using registry at', BOWER_REGISTRY_CONFIG.register)
  try {
    // TODO: npm implementation
    const bowerJSONPath = path.join(cwd, 'bower.json')
    const hasBowerJSON = fs.existsSync(bowerJSONPath)

    const bowerJSON = {
      name: undefined,
      repository: undefined,
      framework: undefined,
      ...(hasBowerJSON ? await readValidateJSON(bowerJSONPath) : {})
    }
    const properties = await confirm(bowerJSON)
    hasBowerJSON && await fs.writeJSON(bowerJSONPath, properties, { spaces: 2, replacer: null })

    // given a package name, create two Plugin representations
    // if supplied name is adapt-contrib-myPackageName do a check against this name only
    // if suppled name is adapt-myPackageName check against this name and adapt-contrib-myPackageName
    // becase we don't want to allow adapt-myPackageName if adapt-contrib-myPackageName exists
    const plugin = new Plugin({ name: properties.name, logger })
    const contribPlugin = new Plugin({ name: properties.name, isContrib: true, logger })
    const contribExists = await exists(BOWER_REGISTRY_CONFIG, contribPlugin)
    const pluginExists = await exists(BOWER_REGISTRY_CONFIG, plugin)

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
async function exists (BOWER_REGISTRY_CONFIG, plugin) {
  const pluginName = plugin.toString().toLowerCase()
  return new Promise((resolve, reject) => {
    // TODO: npm implementation
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

async function registerWithBowerRepo (BOWER_REGISTRY_CONFIG, plugin, repository) {
  return new Promise((resolve, reject) => {
    // TODO: npm implementation
    bower.commands.register(plugin.toString(), repository.url || repository, {
      registry: BOWER_REGISTRY_CONFIG
    })
      .on('end', resolve)
      .on('error', reject)
  })
}
