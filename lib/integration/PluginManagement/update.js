import chalk from 'chalk'
import Project from '../Project.js'
import { createPromptTask } from '../../util/createPromptTask.js'
import { errorPrinter, packageNamePrinter, versionPrinter, existingVersionPrinter } from './print.js'
import { promiseAllProgress, forEachPromise, forEachPromiseProgress } from '../../util/promises.js'
/** @typedef {import("../Plugin.js").default} Plugin */

export default async function update ({
  plugins,
  cwd = process.cwd(),
  logger = null,
  // whether to summarise installed plugins without modifying anything
  isDryRun = false
}) {
  const project = new Project({ cwd, logger })
  project.throwInvalid()

  logger?.log(chalk.cyan('update adapt dependencies...'))

  const updateTargets = await getUpdateTargets({ logger, project, plugins, isDryRun })
  if (!updateTargets?.length) return

  await loadPluginData({ logger, project, plugins: updateTargets })
  await interactiveConflictResolution({ logger, plugins: updateTargets })
  if (isDryRun) {
    await summariseDryRun({ logger, plugins: updateTargets })
    return
  }
  const updateTargetsToBeUpdated = updateTargets.filter(plugin => plugin.isToBeInstalled)
  if (updateTargetsToBeUpdated.length) {
    await forEachPromiseProgress({
      array: updateTargetsToBeUpdated,
      iterator: plugin => plugin.update(),
      progress: percentage => {
        logger?.logProgress(`${chalk.bold.cyan('<info>')} Updating plugins ${percentage}% complete`)
      }
    })
    logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Updating plugins 100% complete`)
  }
  await summariseUpdates({ logger, plugins: updateTargets })
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 */
async function getUpdateTargets ({ project, plugins, isDryRun }) {
  if (typeof plugins === 'string') plugins = [plugins]
  const allowedTypes = ['all', 'components', 'extensions', 'menu', 'theme']
  const selectedTypes = [...new Set(plugins.filter(type => allowedTypes.includes(type)))]
  const isEmpty = (!plugins.length)
  const isAll = (isDryRun || isEmpty || selectedTypes.includes('all'))
  const pluginNames = plugins
    // remove types
    .filter(arg => !allowedTypes.includes(arg))
    // split name/version
    .map(arg => {
      const [name, version = '*'] = arg.split(/[#@]/)
      return [name, version]
    })
    // make sure last applies
    .reverse()

  /** @type {[Plugin]} */
  let updateTargets = await project.getUpdateTargets()
  for (const plugin of updateTargets) {
    await plugin.fetchProjectInfo()
  }
  if (!isDryRun && isEmpty) {
    const shouldContinue = await createPromptTask({
      message: chalk.reset('This command will attempt to update all installed plugins. Do you wish to continue?'),
      type: 'confirm'
    })
    if (!shouldContinue) return
  }
  if (!isAll) {
    const filtered = {}
    for (const plugin of updateTargets) {
      const type = await plugin.getType()
      if (!type) continue
      const lastSpecifiedPluginName = pluginNames.find(([name]) => plugin.isNameMatch(name))
      const isPluginNameIncluded = Boolean(lastSpecifiedPluginName)
      const isTypeIncluded = selectedTypes.includes(type.belongsTo)
      if (!isPluginNameIncluded && !isTypeIncluded) continue
      // Resolve duplicates
      filtered[plugin.packageName] = plugin
      // Set requested version from name
      plugin.requestedVersion = lastSpecifiedPluginName[1] || '*'
    }
    updateTargets = Object.values(filtered)
  }
  return updateTargets
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
    promises: plugins.map(plugin => plugin.markUpdateable()),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Marking updateable ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking updateable 100% complete`)
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
      header: chalk.bold.cyan('<info> ') + header,
      list,
      prompt
    }
  }
  const preFilteredPlugins = plugins.filter(plugin => !plugin.isLocalSource)
  const allQuestions = [
    add(preFilteredPlugins.filter(plugin => !plugin.hasFrameworkCompatibleVersion), 'There is no compatible version of the following plugins:', getPrompt),
    add(preFilteredPlugins.filter(plugin => plugin.hasFrameworkCompatibleVersion && !plugin.hasValidRequestVersion), 'The version requested is invalid, there are newer compatible versions of the following plugins:', getPrompt),
    add(preFilteredPlugins.filter(plugin => plugin.hasFrameworkCompatibleVersion && plugin.hasValidRequestVersion && !plugin.isApplyLatestCompatibleVersion), 'There are newer compatible versions of the following plugins:', getPrompt)
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
 * @param {object} param0
 * @param {[Plugin]} param0.plugins
 */
function summariseDryRun ({ logger, plugins }) {
  const preFilteredPlugins = plugins.filter(plugin => !plugin.isLocalSource)
  const localSources = plugins.filter(plugin => plugin.isLocalSource)
  const toBeInstalled = preFilteredPlugins.filter(plugin => plugin.isToBeUpdated)
  const toBeSkipped = preFilteredPlugins.filter(plugin => !plugin.isToBeUpdated || plugin.isSkipped)
  const missing = preFilteredPlugins.filter(plugin => plugin.isMissing)
  summarise(logger, localSources, packageNamePrinter, 'The following plugins were installed from a local source and cannot be updated:')
  summarise(logger, toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, toBeInstalled, versionPrinter, 'The following plugins will be updated:')
}

/**
 * @param {object} param0
 * @param {[Plugin]} param0.plugins
 */
function summariseUpdates ({ logger, plugins }) {
  const preFilteredPlugins = plugins.filter(plugin => !plugin.isLocalSource)
  const localSources = plugins.filter(plugin => plugin.isLocalSource)
  const installSucceeded = preFilteredPlugins.filter(plugin => plugin.isUpdateSuccessful)
  const installSkipped = preFilteredPlugins.filter(plugin => plugin.isSkipped)
  const noUpdateAvailable = preFilteredPlugins.filter(plugin => !plugin.isToBeUpdated && !plugin.isSkipped)
  const installErrored = preFilteredPlugins.filter(plugin => plugin.isUpdateFailure)
  const missing = preFilteredPlugins.filter(plugin => plugin.isMissing)
  const noneInstalled = (installSucceeded.length === 0)
  const allInstalledSuccessfully = (installErrored.length === 0 && missing.length === 0)
  const someInstalledSuccessfully = (!noneInstalled && !allInstalledSuccessfully)
  summarise(logger, localSources, existingVersionPrinter, 'The following plugins were installed from a local source and cannot be updated:')
  summarise(logger, installSkipped, existingVersionPrinter, 'The following plugins were skipped:')
  summarise(logger, noUpdateAvailable, existingVersionPrinter, 'The following plugins had no update available:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, installErrored, errorPrinter, 'The following plugins could not be updated:')
  if (noneInstalled) logger?.log(chalk.cyanBright('None of the requested plugins could be updated'))
  else if (allInstalledSuccessfully) summarise(logger, installSucceeded, existingVersionPrinter, 'All requested plugins were successfully updated. Summary of installation:')
  else if (someInstalledSuccessfully) summarise(logger, installSucceeded, existingVersionPrinter, 'The following plugins were successfully updated:')
}

function summarise (logger, list, iterator, header) {
  if (!list || !iterator || list.length === 0) return
  logger?.log(chalk.cyanBright(header))
  list.forEach(iterator)
}
