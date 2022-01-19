import chalk from 'chalk'
import { createPromptTask } from '../../util/createPromptTask.js'
import path from 'path'
import semver from 'semver'
import { installErroredPrinter, packageNamePrinter, versionPrinter } from './print.js'
import fs from 'fs-extra'
import { exec } from 'child_process'
import { promiseAllProgress, forEachPromise } from '../../util/promises.js'
import Project from '../Project.js'
import InstallTarget from './InstallTarget.js'
import { eachLimit } from 'async'

export default async function install ({
  plugins,
  dev = false,
  localDir = process.cwd(),
  logger = null,
  isDryRun = true, // whether to summarise installation without modifying anything
  isCompatibleEnabled = false
}) {
  const project = new Project({ localDir, logger })
  project.throwInvalid()
  /** whether adapt.json is being used to compile the list of plugins to install */
  const isUsingManifest = !plugins?.length
  /** a list of plugin name/version pairs */
  const itinerary = isUsingManifest
    ? project.pluginDependencies
    : plugins.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      // Duplicates are removed by assigning to object properties
      itinerary[name] = version
      return itinerary
    }, {})
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)

  logger?.log(chalk.cyan(`${dev ? 'cloning' : 'installing'} adapt dependencies...`))
  /**
   * @type {[InstallTarget]}
   */
  const installTargets = pluginNames.length
    ? pluginNames.map(nameVersion => {
      const [name, requestedVersion] = nameVersion.split(/[#@]/)
      return new InstallTarget({ name, requestedVersion, isCompatibleEnabled, project })
    })
    : project.installTargets

  if (dev) {
    await cloneInstall({ logger, project, plugins: installTargets })
  } else {
    await bowerInstall({ logger, project, plugins: installTargets, isDryRun, isUsingManifest })
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
  await interactiveConflictResolution(logger, plugins)
  if (isDryRun) {
    summariseDryRun({ logger, plugins })
    return
  }
  await promiseAllProgress(plugins.filter(plugin => plugin.isToBeInstalled).map(plugin => plugin.install()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Installing plugins ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Installing plugins 100% complete`)
  if (!isUsingManifest) await updateManifest({ project, plugins })
  return summariseInstallation({ plugins })
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
    default: true
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
 * @returns
 */
async function interactiveConflictResolution (logger, plugins) {
  async function getPromptIncompatibleGeneric (plugin) {
    const result = await createPromptTask({ message: chalk.reset(plugin.packageName), choices: [{ name: 'latest version', value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's' })
    const installLatest = result === 'l'
    if (installLatest) plugin.markLatestForInstallation()
  }
  async function getPromptCompatibleWithOldIncompatibleConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${semver.maxSatisfying(plugin._versions, plugin.version)}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's' })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithOldCompatibleConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${plugin._resolvedConstraint}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's' })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithNewCompatibleConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${plugin._resolvedConstraint}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's' })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithBadConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), type: 'list', choices: [{ name: `compatible version [${plugin._latestCompatibleVersion}]`, value: 'c' }, { name: 'skip', value: 's' }], default: 's' })
    const installLatestCompatible = result === 'c'
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  async function getPromptCompatibleWithUnmetConstraint (plugin) {
    const result = await createPromptTask({ message: chalk.white(plugin.packageName), choices: [{ name: `requested version [${semver.maxSatisfying(plugin._versions, plugin.version)}]`, value: 'r' }, { name: `latest compatible version [${plugin._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's' })
    const installRequested = result === 'r'
    const installLatestCompatible = result === 'l'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatestCompatible) plugin.markLatestCompatibleForInstallation()
  }
  function add (list, header, prompt) {
    if (!list.length) return
    return {
      header: chalk.cyan('<info> ') + header,
      list,
      prompt
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
    logger?.log(question.header)
    await forEachPromise(question.list, question.prompt)
  }
}

/**
 *
 * @param {[InstallTarget]} plugins
 */
function summariseDryRun ({ logger, plugins }) {
  const toBeInstalled = plugins.filter(plugin => plugin.isToBeInstalled)
  const toBeSkipped = plugins.filter(plugin => plugin.isSkipped)
  const missing = plugins.filter(plugin => plugin.isMissing)
  summarise(toBeInstalled, versionPrinter, 'The following plugins will be installed:')
  summarise(toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return
    logger?.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

function summariseInstallation ({ logger, plugins }) {
  // console.log('install::summariseInstallation');
  const installSucceeded = plugins.filter(plugin => plugin.isInstallSuccessful)
  const installSkipped = plugins.filter(plugin => plugin.isSkipped)
  const installErrored = plugins.filter(plugin => plugin.isInstallFailure)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const allSuccess = 'All requested plugins were successfully installed. Summary of installation:'
  const someSuccess = 'The following plugins were successfully installed:'
  const noSuccess = 'None of the requested plugins could be installed'
  const successMsg = (installErrored.length === 0 && missing.length === 0)
    ? allSuccess
    : someSuccess
  if (installSucceeded.length === 0) logger?.log(chalk.cyanBright(noSuccess))
  else summarise(installSucceeded, versionPrinter, successMsg)
  summarise(installSkipped, packageNamePrinter, 'The following plugins were skipped:')
  summarise(installErrored, installErroredPrinter, 'The following plugins could not be installed:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return
    logger?.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}
