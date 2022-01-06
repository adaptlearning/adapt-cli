
import { getBowerRegistry } from '../integration/PluginManagement.js'
import fs from 'fs-extra'
import path from 'path'
import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import { readValidateJSON } from '../util/JSONReadValidate.js'
import Plugin from '../integration/Plugin.js'
import semver from 'semver'
import Project from '../integration/Project.js'

export default async function register ({
  logger,
  localDir
}) {
  const project = new Project({ logger })
  const BOWER_REGISTRY_URL = getBowerRegistry(project)

  logger?.log(chalk.yellow('This will publish this plugin to', BOWER_REGISTRY_URL))

  try {
    const bowerJSONPath = path.join(localDir, 'bower.json')
    if (!fs.existsSync(bowerJSONPath)) {
      throw new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.')
    }

    const bowerJSON = Object.assign(await readValidateJSON(bowerJSONPath), {
      name: undefined,
      repository: undefined,
      framework: undefined
    })
    const properties = await confirm(bowerJSON)
    await fs.writeJSON(bowerJSONPath, properties, { spaces: 2, replacer: null })

    // given a package name, create two Plugin representations
    // if supplied name is adapt-contrib-myPackageName do a check against this name only
    // if suppled name is adapt-myPackageName check against this name and adapt-contrib-myPackageName
    // becase we don't want to allow adapt-myPackageName if adapt-contrib-myPackageName exists
    const plugin = new Plugin({ name: properties.name })
    const contribPlugin = new Plugin({ name: properties.name, isContrib: true })
    const contribExists = exists(BOWER_REGISTRY_URL, contribPlugin)
    const pluginExists = exists(BOWER_REGISTRY_URL, plugin)

    if (contribExists || pluginExists) {
      logger?.log(chalk.yellow(plugin.toString()), chalk.cyan('has been previously registered. Plugin names must be unique. Try again with a different name.'))
      return
    }

    const result = await registerWithBowerRepo(BOWER_REGISTRY_URL, plugin, properties.repository)
    if (!result) throw new Error('The plugin was unable to register.')
    logger?.log(chalk.green(plugin.packageName), 'has been registered successfully.')
  } catch (err) {
    logger?.log(chalk.red(err))
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
      .on('end', result => {
        const matches = result.filter(exactMatch(plugin.toString()))
        resolve(!!matches.length)
      })
      .on('error', reject)
  })
}

async function registerWithBowerRepo (BOWER_REGISTRY_URL, plugin, repository) {
  return new Promise((resolve, reject) => {
    bower.commands.register(plugin.toString(), repository.url || repository, {
      registry: BOWER_REGISTRY_URL
    })
      .on('end', resolve)
      .on('error', reject)
  })
}
