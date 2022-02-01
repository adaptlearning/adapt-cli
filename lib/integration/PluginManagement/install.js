import chalk from 'chalk'
import { createPromptTask } from '../../util/createPromptTask.js'
import { errorPrinter, packageNamePrinter, versionPrinter } from './print.js'
import { promiseAllProgress, forEachPromise, forEachPromiseProgress } from '../../util/promises.js'
import Project from '../Project.js'
import Plugin from '../Plugin.js'
import bower from 'bower'
import { difference } from 'lodash-es'

export default async function install ({
  plugins,
  dev = false,
  cwd = process.cwd(),
  logger = null,
  isDryRun = true, // whether to summarise installation without modifying anything
  isCompatibleEnabled = false,
  isClean = false
}) {
  isClean && await new Promise(resolve => bower.commands.cache.clean().on('end', resolve))
  const project = new Project({ cwd, logger })
  project.throwInvalid()

  logger?.log(chalk.cyan(`${dev ? 'cloning' : 'installing'} adapt dependencies...`))

  const installTargets = await getInstallTargets({ logger, project, plugins, isCompatibleEnabled })
  if (!installTargets?.length) return

  await loadPluginData({ logger, project, plugins: installTargets })
  await interactiveConflictResolution({ logger, plugins: installTargets })
  if (isDryRun) {
    await summariseDryRun({ logger, plugins: installTargets })
    return
  }
  const installTargetsToBeInstalled = installTargets.filter(plugin => plugin.isToBeInstalled)
  if (installTargetsToBeInstalled.length) {
    await forEachPromiseProgress({
      array: installTargetsToBeInstalled,
      iterator: plugin => plugin.install({ clone: dev }),
      progress: percentage => {
        logger?.logProgress(`${chalk.bold.cyan('<info>')} Installing plugins ${percentage}% complete`)
      }
    })
    logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Installing plugins 100% complete`)
    await updateManifest({ logger, project, plugins: installTargets, pluginDependencies: await project.getPluginDependencies() })
  }
  await summariseInstallation({ logger, plugins: installTargets })
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 */
async function getInstallTargets ({ logger, project, plugins, isCompatibleEnabled }) {
  /** whether adapt.json is being used to compile the list of plugins to install */
  const isEmpty = !plugins?.length
  /** a list of plugin name/version pairs */
  const itinerary = isEmpty
    ? await project.getPluginDependencies()
    : plugins.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      // Duplicates are removed by assigning to object properties
      itinerary[name] = version
      return itinerary
    }, {})
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)

  /**
   * @type {[Plugin]}
   */
  const installTargets = pluginNames.length
    ? pluginNames.map(nameVersion => {
      const [name, requestedVersion] = nameVersion.split(/[#@]/)
      return new Plugin({ name, requestedVersion, isCompatibleEnabled, project, logger })
    })
    : await project.getInstallTargets()
  return installTargets
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 */
async function loadPluginData ({ logger, project, plugins }) {
  const frameworkVersion = project.version
  await promiseAllProgress({
    promises: plugins.map(plugin => plugin.fetchSourceInfo()),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await promiseAllProgress({
    promises: plugins.map(plugin => plugin.findCompatibleVersion(frameworkVersion)),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Finding compatible source versions ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Finding compatible source versions 100% complete`)
  await promiseAllProgress({
    promises: plugins.map(plugin => plugin.markInstallable()),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Marking installable ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking installable 100% complete`)
}

/**
 * @param {object} param0
 * @param {[Plugin]} param0.plugins
 */
async function interactiveConflictResolution ({ logger, plugins }) {
  /** @param {Plugin} plugin */
  async function getPrompt (plugin) {
    const canApplyRequested = plugin.hasValidRequestVersion &&
      (plugin.hasFrameworkCompatibleVersion
        ? (plugin.latestCompatibleSourceVersion !== plugin.proposedVersion)
        : (plugin.latestSourceVersion !== plugin.proposedVersion))
    const choices = [
      canApplyRequested && { name: `requested version [${plugin.proposedVersion}]`, value: 'r' },
      plugin.hasFrameworkCompatibleVersion
        ? { name: `latest compatible version [${plugin.latestCompatibleSourceVersion}]`, value: 'l' }
        : { name: `latest version [${plugin.latestSourceVersion}]`, value: 'l' },
      { name: 'skip', value: 's' }
    ].filter(Boolean)
    const result = await createPromptTask({ message: chalk.reset(plugin.packageName), choices, type: 'list', default: 's' })
    const installRequested = (result === 'r')
    const installLatest = result === 'l'
    const skipped = result === 's'
    if (installRequested) plugin.markRequestedForInstallation()
    if (installLatest && plugin.hasFrameworkCompatibleVersion) plugin.markLatestCompatibleForInstallation()
    if (installLatest && !plugin.hasFrameworkCompatibleVersion) plugin.markLatestForInstallation()
    if (skipped) plugin.markSkipped()
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
    add(plugins.filter(plugin => !plugin.hasFrameworkCompatibleVersion), 'There is no compatible version of the following plugins:', getPrompt),
    add(plugins.filter(plugin => plugin.hasFrameworkCompatibleVersion && !plugin.hasValidRequestVersion), 'The version requested is invalid, there are newer compatible versions of the following plugins:', getPrompt),
    add(plugins.filter(plugin => plugin.hasFrameworkCompatibleVersion && plugin.hasValidRequestVersion && !plugin.isApplyLatestCompatibleVersion), 'There are newer compatible versions of the following plugins:', getPrompt)
  ].filter(Boolean)
  if (allQuestions.length === 0) return
  for (const question of allQuestions) {
    logger?.log(question.header)
    await forEachPromise({
      array: question.list,
      iterator: question.prompt
    })
  }
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 */
async function updateManifest ({ project, plugins, pluginDependencies }) {
  if (plugins.filter(plugin => plugin.isInstallSuccessful).length === 0) return
  if (difference(plugins.filter(plugin => plugin.isInstallSuccessful).map(plugin => plugin.packageName), Object.keys(pluginDependencies)).length === 0) return
  const shouldUpdate = await createPromptTask({
    message: chalk.white('Update the manifest (adapt.json)?'),
    type: 'confirm',
    default: true
  })
  if (!shouldUpdate) return
  plugins.forEach(plugin => plugin.isInstallSuccessful && project.add(plugin))
}

/**
 * @param {object} param0
 * @param {[Plugin]} param0.plugins
 */
function summariseDryRun ({ logger, plugins }) {
  const toBeInstalled = plugins.filter(plugin => plugin.isToBeInstalled)
  const toBeSkipped = plugins.filter(plugin => !plugin.isToBeInstalled || plugin.isSkipped)
  const missing = plugins.filter(plugin => plugin.isMissing)
  summarise(logger, toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, toBeInstalled, versionPrinter, 'The following plugins will be installed:')
}

/**
 * @param {object} param0
 * @param {[Plugin]} param0.plugins
 */
function summariseInstallation ({ logger, plugins }) {
  const installSucceeded = plugins.filter(plugin => plugin.isInstallSuccessful)
  const installSkipped = plugins.filter(plugin => !plugin.isToBeInstalled || plugin.isSkipped)
  const installErrored = plugins.filter(plugin => plugin.isInstallFailure)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const noneInstalled = (installSucceeded.length === 0)
  const allInstalledSuccessfully = (installErrored.length === 0 && missing.length === 0)
  const someInstalledSuccessfully = (!noneInstalled && !allInstalledSuccessfully)
  summarise(logger, installSkipped, packageNamePrinter, 'The following plugins were skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, installErrored, errorPrinter, 'The following plugins could not be installed:')
  if (noneInstalled) logger?.log(chalk.cyanBright('None of the requested plugins could be installed'))
  else if (allInstalledSuccessfully) summarise(logger, installSucceeded, versionPrinter, 'All requested plugins were successfully installed. Summary of installation:')
  else if (someInstalledSuccessfully) summarise(logger, installSucceeded, versionPrinter, 'The following plugins were successfully installed:')
}

function summarise (logger, list, iterator, header) {
  if (!list || !iterator || list.length === 0) return
  logger?.log(chalk.cyanBright(header))
  list.forEach(iterator)
}
