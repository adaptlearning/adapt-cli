import chalk from 'chalk'
import { eachOfSeries } from 'async'
import { createPromptTask } from '../../util/createPromptTask.js'
import { errorPrinter, packageNamePrinter, versionPrinter } from './print.js'
import { eachOfLimitProgress, eachOfSeriesProgress } from '../../util/promises.js'
import Project from '../Project.js'
import Target from '../Target.js'
import bower from 'bower'
import { difference } from 'lodash-es'
import path from 'path'

export default async function install ({
  plugins,
  dev = false,
  isInteractive = true,
  isDryRun = false, // whether to summarise installation without modifying anything
  isCompatibleEnabled = false,
  isClean = false,
  cwd = process.cwd(),
  logger = null
}) {
  cwd = path.resolve(process.cwd(), cwd)
  isClean && await new Promise(resolve => bower.commands.cache.clean().on('end', resolve))
  const project = new Project({ cwd, logger })
  project.tryThrowInvalidPath()

  logger?.log(chalk.cyan(`${dev ? 'cloning' : 'installing'} adapt dependencies...`))

  const targets = await getInstallTargets({ logger, project, plugins, isCompatibleEnabled })
  if (!targets?.length) return

  await loadPluginData({ logger, project, targets })
  await conflictResolution({ logger, targets, isInteractive, dev })
  if (isDryRun) {
    await summariseDryRun({ logger, targets })
    return
  }
  const installTargetsToBeInstalled = targets.filter(target => target.isToBeInstalled)
  if (installTargetsToBeInstalled.length) {
    await eachOfSeriesProgress(
      installTargetsToBeInstalled,
      target => target.install({ clone: dev }),
      percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Installing plugins ${percentage}% complete`)
    )
    logger?.log(`${chalk.bold.cyan('<info>')} Installing plugins 100% complete`)
    const manifestDependencies = await project.getManifestDependencies()
    await updateManifest({ logger, project, targets, manifestDependencies, isInteractive })
  }
  await summariseInstallation({ logger, targets, dev })
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[string]} options.plugins
 */
async function getInstallTargets ({ logger, project, plugins, isCompatibleEnabled }) {
  if (typeof plugins === 'string') plugins = [plugins]
  /** whether adapt.json is being used to compile the list of plugins to install */
  const isEmpty = !plugins?.length
  /** a list of plugin name/version pairs */
  const itinerary = isEmpty
    ? await project.getManifestDependencies()
    : plugins.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      // Duplicates are removed by assigning to object properties
      itinerary[name] = version
      return itinerary
    }, {})
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)

  /**
   * @type {[Target]}
   */
  const targets = pluginNames.length
    ? pluginNames.map(nameVersion => {
      const [name, requestedVersion] = nameVersion.split(/[#@]/)
      return new Target({ name, requestedVersion, isCompatibleEnabled, project, logger })
    })
    : await project.getInstallTargets()
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
    target => target.markInstallable(),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Marking installable ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Marking installable 100% complete`)
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
async function conflictResolution ({ logger, targets, isInteractive, dev }) {
  /** @param {Target} target */
  async function checkVersion (target) {
    const canApplyRequested = target.hasValidRequestVersion &&
      (target.hasFrameworkCompatibleVersion
        ? (target.latestCompatibleSourceVersion !== target.matchedVersion)
        : (target.latestSourceVersion !== target.matchedVersion))
    if (!isInteractive) {
      if (canApplyRequested) return target.markRequestedForInstallation()
      return target.markSkipped()
    }
    const choices = [
      dev && { name: 'master [master]', value: 'm' },
      canApplyRequested && { name: `requested version [${target.matchedVersion}]`, value: 'r' },
      target.hasFrameworkCompatibleVersion
        ? { name: `latest compatible version [${target.latestCompatibleSourceVersion}]`, value: 'l' }
        : { name: `latest version [${target.latestSourceVersion}]`, value: 'l' },
      { name: 'skip', value: 's' }
    ].filter(Boolean)
    const result = await createPromptTask({ message: chalk.reset(target.packageName), choices, type: 'list', default: 's' })
    const installMasterBranch = (result === 'm')
    const installRequested = (result === 'r')
    const installLatest = result === 'l'
    const skipped = result === 's'
    if (installMasterBranch) target.markMasterForInstallation()
    if (installRequested) target.markRequestedForInstallation()
    if (installLatest && target.hasFrameworkCompatibleVersion) target.markLatestCompatibleForInstallation()
    if (installLatest && !target.hasFrameworkCompatibleVersion) target.markLatestForInstallation()
    if (skipped) target.markSkipped()
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
    add(targets.filter(target => !target.hasFrameworkCompatibleVersion), 'There is no compatible version of the following plugins:', checkVersion),
    add(targets.filter(target => target.hasFrameworkCompatibleVersion && !target.hasValidRequestVersion), 'The version requested is invalid, there are newer compatible versions of the following plugins:', checkVersion),
    add(targets.filter(target => target.hasFrameworkCompatibleVersion && target.hasValidRequestVersion && !target.isApplyLatestCompatibleVersion), 'There are newer compatible versions of the following plugins:', checkVersion)
  ].filter(Boolean)
  if (allQuestions.length === 0) return
  for (const question of allQuestions) {
    logger?.log(question.header)
    await eachOfSeries(question.list, question.prompt)
  }
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Target]} options.targets
 */
async function updateManifest ({ project, targets, manifestDependencies, isInteractive }) {
  if (targets.filter(target => target.isInstallSuccessful).length === 0) return
  if (difference(targets.filter(target => target.isInstallSuccessful).map(target => target.packageName), Object.keys(manifestDependencies)).length === 0) return
  if (isInteractive) {
    const shouldUpdate = await createPromptTask({
      message: chalk.white('Update the manifest (adapt.json)?'),
      type: 'confirm',
      default: true
    })
    if (!shouldUpdate) return
  }
  targets.forEach(target => target.isInstallSuccessful && project.add(target))
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
function summariseDryRun ({ logger, targets }) {
  const toBeInstalled = targets.filter(target => target.isToBeInstalled)
  const toBeSkipped = targets.filter(target => !target.isToBeInstalled || target.isSkipped)
  const missing = targets.filter(target => target.isMissing)
  summarise(logger, toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, toBeInstalled, versionPrinter, 'The following plugins will be installed:')
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
function summariseInstallation ({ logger, targets, dev }) {
  const installSucceeded = targets.filter(target => target.isInstallSuccessful)
  const installSkipped = targets.filter(target => !target.isToBeInstalled || target.isSkipped)
  const installErrored = targets.filter(target => target.isInstallFailure)
  const missing = targets.filter(target => target.isMissing)
  const noneInstalled = (installSucceeded.length === 0)
  const allInstalledSuccessfully = (installErrored.length === 0 && missing.length === 0)
  const someInstalledSuccessfully = (!noneInstalled && !allInstalledSuccessfully)
  summarise(logger, installSkipped, packageNamePrinter, 'The following plugins were skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, installErrored, errorPrinter, 'The following plugins could not be installed:')
  if (noneInstalled) logger?.log(chalk.cyanBright('None of the requested plugins could be installed'))
  else if (allInstalledSuccessfully) summarise(logger, installSucceeded, dev ? packageNamePrinter : versionPrinter, 'All requested plugins were successfully installed. Summary of installation:')
  else if (someInstalledSuccessfully) summarise(logger, installSucceeded, dev ? packageNamePrinter : versionPrinter, 'The following plugins were successfully installed:')
}

function summarise (logger, list, iterator, header) {
  if (!list || !iterator || list.length === 0) return
  logger?.log(chalk.cyanBright(header))
  list.forEach(item => iterator(item, logger))
}
