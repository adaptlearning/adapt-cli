import chalk from 'chalk'
import { eachOfSeries } from 'async'
import path from 'path'
import Project from '../Project.js'
import { createPromptTask } from '../../util/createPromptTask.js'
import { errorPrinter, packageNamePrinter, existingVersionPrinter } from './print.js'
import { eachOfLimitProgress, eachOfSeriesProgress } from '../../util/promises.js'
/** @typedef {import("../Target.js").default} Target */

export default async function update ({
  plugins,
  // whether to summarise installed plugins without modifying anything
  isDryRun = false,
  isInteractive = true,
  cwd = process.cwd(),
  logger = null
}) {
  cwd = path.resolve(process.cwd(), cwd)
  const project = new Project({ cwd, logger })
  project.tryThrowInvalidPath()

  logger?.log(chalk.cyan('update adapt dependencies...'))

  const targets = await getUpdateTargets({ logger, project, plugins, isDryRun, isInteractive })
  if (!targets?.length) return targets

  await loadPluginData({ logger, project, targets })
  await conflictResolution({ logger, targets, isInteractive })
  if (isDryRun) {
    await summariseDryRun({ logger, targets })
    return targets
  }
  const updateTargetsToBeUpdated = targets.filter(target => target.isToBeInstalled)
  if (updateTargetsToBeUpdated.length) {
    await eachOfSeriesProgress(
      updateTargetsToBeUpdated,
      target => target.update(),
      percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Updating plugins ${percentage}% complete`)
    )
    logger?.log(`${chalk.bold.cyan('<info>')} Updating plugins 100% complete`)
  }
  await summariseUpdates({ logger, targets })
  return targets
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[string]} options.plugins
 */
async function getUpdateTargets ({ project, plugins, isDryRun, isInteractive }) {
  if (typeof plugins === 'string') plugins = [plugins]
  if (!plugins) plugins = []
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

  /** @type {[Target]} */
  let targets = await project.getUpdateTargets()
  for (const target of targets) {
    await target.fetchProjectInfo()
  }
  if (!isDryRun && isEmpty && isInteractive) {
    const shouldContinue = await createPromptTask({
      message: chalk.reset('This command will attempt to update all installed plugins. Do you wish to continue?'),
      type: 'confirm'
    })
    if (!shouldContinue) return
  }
  if (!isAll) {
    const filtered = {}
    for (const target of targets) {
      const typeFolder = await target.getTypeFolder()
      if (!typeFolder) continue
      const lastSpecifiedPluginName = pluginNames.find(([name]) => target.isNameMatch(name))
      const isPluginNameIncluded = Boolean(lastSpecifiedPluginName)
      const isTypeIncluded = selectedTypes.includes(typeFolder)
      if (!isPluginNameIncluded && !isTypeIncluded) continue
      // Resolve duplicates
      filtered[target.packageName] = target
      // Set requested version from name
      target.requestedVersion = lastSpecifiedPluginName[1] || '*'
    }
    targets = Object.values(filtered)
  }
  return targets
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Target]} options.targets
 */
async function loadPluginData ({ logger, project, targets }) {
  const frameworkVersion = project.version
  await eachOfLimitProgress(
    targets,
    target => target.fetchSourceInfo(),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await eachOfLimitProgress(
    targets,
    target => target.findCompatibleVersion(frameworkVersion),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Finding compatible source versions ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Finding compatible source versions 100% complete`)
  await eachOfLimitProgress(
    targets,
    target => target.markUpdateable(),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Marking updateable ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Marking updateable 100% complete`)
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
async function conflictResolution ({ logger, targets, isInteractive }) {
  /** @param {Target} target */
  async function checkVersion (target) {
    const canApplyRequested = target.hasValidRequestVersion &&
      (target.hasFrameworkCompatibleVersion
        ? (target.latestCompatibleSourceVersion !== target.matchedVersion)
        : (target.latestSourceVersion !== target.matchedVersion))
    if (!isInteractive) {
      if (target.canApplyRequested) return target.markRequestedForInstallation()
      return target.markSkipped()
    }
    const choices = [
      canApplyRequested && { name: `requested version [${target.matchedVersion}]`, value: 'r' },
      target.hasFrameworkCompatibleVersion
        ? { name: `latest compatible version [${target.latestCompatibleSourceVersion}]`, value: 'l' }
        : { name: `latest version [${target.latestSourceVersion}]`, value: 'l' },
      { name: 'skip', value: 's' }
    ].filter(Boolean)
    const result = await createPromptTask({ message: chalk.reset(target.packageName), choices, type: 'list', default: 's' })
    const installRequested = (result === 'r')
    const installLatest = result === 'l'
    const skipped = result === 's'
    if (installRequested) target.markRequestedForInstallation()
    if (installLatest && target.hasFrameworkCompatibleVersion) target.markLatestCompatibleForInstallation()
    if (installLatest && !target.hasFrameworkCompatibleVersion) target.markLatestForInstallation()
    if (skipped) target.markSkipped()
  }
  function add (list, header, prompt) {
    if (!list.length) return
    return {
      header: chalk.bold.cyan('<info> ') + header,
      list,
      prompt
    }
  }
  const preFilteredPlugins = targets.filter(target => !target.isLocalSource)
  const allQuestions = [
    add(preFilteredPlugins.filter(target => !target.hasFrameworkCompatibleVersion && target.latestSourceVersion), 'There is no compatible version of the following plugins:', checkVersion),
    add(preFilteredPlugins.filter(target => target.hasFrameworkCompatibleVersion && !target.hasValidRequestVersion), 'The version requested is invalid, there are newer compatible versions of the following plugins:', checkVersion),
    add(preFilteredPlugins.filter(target => target.hasFrameworkCompatibleVersion && target.hasValidRequestVersion && !target.isApplyLatestCompatibleVersion), 'There are newer compatible versions of the following plugins:', checkVersion)
  ].filter(Boolean)
  if (allQuestions.length === 0) return
  for (const question of allQuestions) {
    logger?.log(question.header)
    await eachOfSeries(question.list, question.prompt)
  }
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
function summariseDryRun ({ logger, targets }) {
  const preFilteredPlugins = targets.filter(target => !target.isLocalSource)
  const localSources = targets.filter(target => target.isLocalSource)
  const toBeInstalled = preFilteredPlugins.filter(target => target.isToBeUpdated)
  const toBeSkipped = preFilteredPlugins.filter(target => !target.isToBeUpdated || target.isSkipped)
  const missing = preFilteredPlugins.filter(target => target.isMissing)
  summarise(logger, localSources, packageNamePrinter, 'The following plugins were installed from a local source and cannot be updated:')
  summarise(logger, toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, toBeInstalled, existingVersionPrinter, 'The following plugins will be updated:')
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
function summariseUpdates ({ logger, targets }) {
  const preFilteredPlugins = targets.filter(target => !target.isLocalSource)
  const localSources = targets.filter(target => target.isLocalSource)
  const installSucceeded = preFilteredPlugins.filter(target => target.isUpdateSuccessful)
  const installSkipped = preFilteredPlugins.filter(target => target.isSkipped)
  const noUpdateAvailable = preFilteredPlugins.filter(target => !target.isToBeUpdated && !target.isSkipped)
  const installErrored = preFilteredPlugins.filter(target => target.isUpdateFailure)
  const missing = preFilteredPlugins.filter(target => target.isMissing)
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
  list.forEach(item => iterator(item, logger))
}
