import chalk from 'chalk'
import { createPromptTask } from '../../util/createPromptTask.js'
import path from 'path'
import semver from 'semver'
import Errors from '../../util/errors.js'
import { readValidateJSONSync } from '../../util/JSONReadValidate.js'
import fs from 'fs-extra'
import { exec } from 'child_process'
import { promiseAllProgress, promiseAllSerialize } from '../../util/promises.js'
import Project from '../Project.js'
import InstallTarget from './InstallTarget.js'
import { eachLimit } from 'async'

export default async function installPlugins ({
  pluginNames,
  dev = false,
  localDir = process.cwd(),
  logger = null,
  isDryRun = true, // whether to summarise installation without modifying anything
  isCompatibleEnabled = false,
  isUsingManifest = undefined
}) {
  if (typeof pluginNames === 'string') pluginNames = [pluginNames]

  const project = new Project({ localDir, logger })
  logger?.log(chalk.cyan(`${dev ? 'cloning' : 'installing'} adapt dependencies...`))
  /**
   * @type {[InstallTarget]}
   */
  const plugins = pluginNames
    ? pluginNames.map(nameVersion => {
      const [name, requestedVersion] = nameVersion.split(/[#@]/)
      return new InstallTarget({ name, requestedVersion, isCompatibleEnabled, project })
    })
    : project.installTargets

  if (dev) {
    await cloneInstall({ logger, project, plugins })
  } else {
    await bowerInstall({ logger, project, plugins, isDryRun, isUsingManifest })
  }
}

/**
 *
 * @param {object} logger
 * @param {[InstallTarget]} plugins
 * @returns
 */
async function cloneInstall ({ logger, project, plugins }) {
  return eachLimit(plugins, 8, async (plugin) => {
    const pluginType = await plugin.getType()
    logger?.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...')
    const repoDetails = await plugin.getRepositoryUrl()
    if (!repoDetails) throw new Error('Error: Plugin repository url could not be found.')
    await fs.ensureDir(path.resolve(project.localDir, 'src', pluginType.belongsTo))
    const pluginPath = path.resolve(project.localDir, 'src', pluginType.belongsTo, plugin.name)
    await fs.rm(pluginPath, { recursive: true, force: true })
    const url = repoDetails.url.replace(/^git:\/\//, 'https://')
    try {
      const exitCode = await new Promise((resolve, reject) => {
        try {
          exec(`git clone ${url} "${pluginPath}"`, resolve)
        } catch (err) {
          reject(err)
        }
      })
      if (exitCode) throw new Error(`The plugin was found but failed to download and install. Exit code ${exitCode}`)
    } catch (error) {
      throw new Error(`The plugin was found but failed to download and install. Error ${error}`)
    }
    if (plugin.version !== '*') {
      try {
        await new Promise(resolve => exec(`git checkout -C "${pluginPath}" ${plugin.version}`, resolve))
        logger?.log(chalk.green(plugin.packageName), `is on branch "${plugin.version}".`)
      } catch (err) {
        logger?.log(chalk.yellow(plugin.packageName), `could not checkout branch "${plugin.version}".`)
      }
    }
    logger?.log(chalk.green(plugin.packageName), 'has been installed successfully.')
  })
}

/**
 *
 * @param {object} options
 * @param {object} options.logger
 * @param {Project} options.project
 * @param {[InstallTarget]} options.plugins
 * @param {boolean} options.isDryRun
 * @param {boolean} options.isUsingManifest
 * @returns
 */
async function bowerInstall ({ logger, project, plugins, isDryRun, isUsingManifest }) {
  await loadPluginData(logger, project, plugins)
  await interactiveConflictResolution(plugins)
  if (isDryRun) {
    summariseDryRun(plugins)
    return
  }
  await promiseAllProgress(plugins.filter(plugin => plugin.isToBeInstalled).map(plugin => plugin.install()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Installing plugins ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Installing plugins 100% complete`)
  if (!isUsingManifest) await updateManifest({ project, plugins })
  return summariseInstallation({ plugins, isInteractive: true })
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[InstallTarget]} options.plugins
 * @returns
 */
async function updateManifest ({ project, plugins }) {
  if (plugins.filter(plugin => plugin.isToBeInstalled).length === 0) return
  const shouldUpdate = await createPromptTask({
    message: chalk.white('Update the manifest (adapt.json)?'),
    type: 'confirm',
    default: true,
    onlyRejectOnError: true
  })
  if (!shouldUpdate) return
  plugins.forEach(plugin => plugin.isToBeInstalled && project.add(plugin))
}

async function loadPluginData (logger, project, plugins) {
  const frameworkVersion = project.version
  await promiseAllProgress(plugins.map(plugin => plugin.getInitialInfo()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await promiseAllProgress(plugins.map(plugin => plugin.findCompatibleVersion(frameworkVersion)), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Finding compatible versions ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Finding compatible versions 100% complete`)
  await promiseAllProgress(plugins.map(plugin => plugin.checkConstraint(frameworkVersion)), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Checking constraints ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Checking constraints 100% complete`)
  await promiseAllProgress(plugins.map(plugin => plugin.markInstallable()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Marking installable ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking installable 100% complete`)
}

/**
 * @param {[InstallTarget]} plugins
 * @param {*} isInteractive
 * @returns
 */
async function interactiveConflictResolution (plugins, isInteractive) {
  async function getPromptIncompatibleGeneric (plugin) {
    const result = await createPromptTask({ message: chalk.reset(plugin.packageName), choices: [{ name: 'latest version', value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
    const installLatest = result === 'l'
    if (installLatest) plugin.markLatestForInstallation()
  }
  async function getPromptCompatibleWithOldIncompatibleConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${semver.maxSatisfying(plugin._versions, plugin.version)}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithOldCompatibleConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${plugin._resolvedConstraint}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithNewCompatibleConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${plugin._resolvedConstraint}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithBadConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), type: 'list', choices: [{ name: `compatible version [${plugin._latestCompatibleVersion}]`, value: 'c' }, { name: 'skip', value: 's' }], default: 's', onlyRejectOnError: true })
    const installLatestCompatible = result === 'c'
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithUnmetConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${semver.maxSatisfying(plugin._versions, plugin.version)}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  function add (list, header, prompt) {
    if (!list.length) return
    return {
      header: chalk.cyan('<info> ') + header,
      list: list,
      prompt: prompt
    }
  }
  const allQuestions = [
    add(plugins.filter(plugin => plugin.isIncompatibleWithOldConstraint), 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
    add(plugins.filter(plugin => plugin.isIncompatibleWithLatestConstraint), 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
    add(plugins.filter(plugin => plugin.isIncompatibleWithBadConstraint), 'An invalid constraint was given, but there is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
    add(plugins.filter(plugin => plugin.isIncompatibleWithNoConstraint), 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
    add(plugins.filter(plugin => plugin.isCompatibleWithOldIncompatibleConstraint), 'An older incompatible version has been requested for the following plugins:', getPromptCompatibleWithOldIncompatibleConstraint),
    add(plugins.filter(plugin => plugin.isCompatibleWithOldCompatibleConstraint), 'A compatible but older version has been requested for the following plugins:', getPromptCompatibleWithOldCompatibleConstraint),
    add(plugins.filter(plugin => plugin.isCompatibleWithNewCompatibleConstraint), 'A compatible but newer version has been requested for the following plugins:', getPromptCompatibleWithNewCompatibleConstraint),
    add(plugins.filter(plugin => plugin.isCompatibleWithBadConstraint), 'An invalid constraint was given but a compatible version exists for the following plugins:', getPromptCompatibleWithBadConstraint),
    add(plugins.filter(plugin => plugin.isCompatibleWithUnmetConstraint), 'The requested version is incompatible but a compatible version exists for the following plugins:', getPromptCompatibleWithUnmetConstraint)
  ].filter(Boolean)
  if (allQuestions.length === 0) return
  for (const question of allQuestions) {
    console.log(question.header)
    await promiseAllSerialize(question.list, question.prompt)
  }
}

/**
 *
 * @param {[InstallTarget]} plugins
 */
function summariseDryRun (plugins) {
  const toBeInstalled = plugins.filter(plugin => plugin.isToBeInstalled)
  const toBeSkipped = plugins.filter(plugin => plugin.isSkipped)
  const missing = plugins.filter(plugin => plugin.isMissing)
  summarise(toBeInstalled, versionPrinter, 'The following plugins will be installed:')
  summarise(toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return
    console.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

function summariseInstallation ({ plugins, isInteractive }) {
  // console.log('install::summariseInstallation');
  const installSucceeded = plugins.filter(plugin => plugin.isInstallSuccessful)
  const installSkipped = plugins.filter(plugin => plugin.isSkipped)
  const installErrored = plugins.filter(plugin => plugin.isInstallFailure)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const allSuccess = 'All requested plugins were successfully installed. Summary of installation:'
  const someSuccess = 'The following plugins were successfully installed:'
  const noSuccess = 'None of the requested plugins could be installed'
  let successMsg
  if (!isInteractive) {
    const report = []
    const hasInstalledOnePlugin = (plugins.length === 1)
    if (hasInstalledOnePlugin) {
      const plugin = plugins[0]
      if (installSucceeded.length === 1) {
        const bowerPath = path.join(process.cwd(), 'src', plugin._belongsTo, plugin.packageName, 'bower.json')
        return readValidateJSONSync(bowerPath)
      }
      if (installSkipped.length === 1) {
        throw new Error(plugin._error)
      }
      if (installErrored.length === 1) {
        const error = Object.assign({}, Errors.ERROR_INSTALL_ERROR)
        if (plugin._installError) error.message = plugin._installError
        throw new Error(error)
      }
      throw new Error(Errors.ERROR_NOT_FOUND)
    }
    installSucceeded.forEach(plugin => report.push({
      name: plugin.packageName,
      status: 'fulfilled',
      pluginData: readValidateJSONSync(path.join(process.cwd(), 'src', plugin._belongsTo, plugin.packageName, 'bower.json'))
    }))
    installSkipped.forEach(plugin => report.push({
      name: plugin.packageName,
      status: 'rejected',
      reason: plugin._error
    }))
    installErrored.forEach(plugin => {
      const error = Object.assign({}, Errors.ERROR_INSTALL_ERROR)
      if (plugin._installError) error.message = plugin._installError
      report.push({
        name: plugin.packageName,
        status: 'rejected',
        reason: error
      })
    })
    missing.forEach(plugin => report.push({
      name: plugin.packageName,
      status: 'rejected',
      reason: Errors.ERROR_NOT_FOUND
    }))
    return report
  }
  if (installErrored.length === 0 && missing.length === 0) successMsg = allSuccess
  else if (installSucceeded.length === 0) console.log(chalk.cyanBright(noSuccess))
  else successMsg = someSuccess
  summarise(installSucceeded, versionPrinter, successMsg)
  summarise(installSkipped, packageNamePrinter, 'The following plugins were skipped:')
  summarise(installErrored, installErroredPrinter, 'The following plugins could not be installed:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return
    console.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

// output formatting

function highlight (str) {
  return ['adapt-contrib', 'adapt-'].reduce((output, prefix) => {
    if (output || !str.startsWith(prefix)) return output
    return chalk.reset(prefix) + chalk.yellowBright(str.substring(prefix.length))
  }, null) || str
}

function green (str) {
  return chalk.greenBright(str)
}

function greenIfEqual (v1, v2) {
  return semver.satisfies(v1, v2)
    ? chalk.greenBright(v2)
    : chalk.magentaBright(v2)
}

function versionPrinter (plugin) {
  const vI = plugin._versionToInstall
  const vLC = plugin._latestCompatibleVersion
  console.log(highlight(plugin.packageName), vLC === '*'
    ? '(no version information)'
    : '@' + green(vI), '(latest compatible version is ' + greenIfEqual(vI, vLC) + ')'
  )
}

function installErroredPrinter (plugin) {
  console.log(highlight(plugin.packageName), plugin._installError ? '(error: ' + plugin._installError + ')' : '(unknown error)')
}

function packageNamePrinter (plugin) {
  console.log(highlight(plugin.packageName))
}
