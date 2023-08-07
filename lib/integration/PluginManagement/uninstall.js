
import chalk from 'chalk'
import Project from '../Project.js'
import Target from '../Target.js'
import { eachOfLimitProgress } from '../../util/promises.js'
import { createPromptTask } from '../../util/createPromptTask.js'
import { errorPrinter, packageNamePrinter } from './print.js'
import { intersection } from 'lodash-es'
import path from 'path'
import { uninstall as npmUninstall } from './npm.js'

export default async function uninstall ({
  plugins,
  isInteractive = true,
  cwd = process.cwd(),
  logger = null
}) {
  cwd = path.resolve(process.cwd(), cwd)
  const project = new Project({ cwd, logger })
  project.tryThrowInvalidPath()

  const isNPM = await project.isNPM()

  logger?.log(chalk.cyan('uninstalling adapt dependencies...'))

  const targets = await getUninstallTargets({ logger, project, plugins, isInteractive })
  if (!targets?.length) return targets

  await loadPluginData({ logger, targets })
  const uninstallTargetsToBeUninstalled = targets.filter(target => target.isToBeUninstalled)
  await eachOfLimitProgress(
    uninstallTargetsToBeUninstalled,
    target => target.uninstall(),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Uninstalling plugins ${percentage / (isNPM ? 2 : 1)}% complete`)
  )
  if (isNPM) {
    // Batch uninstall npm plugins as it's faster
    const installArgs = uninstallTargetsToBeUninstalled
      .filter(target => target.isNPMUninstall)
      .map(target => `${target.packageName}`)
    const outputPath = path.join(cwd, 'src')
    await npmUninstall({ logger, cwd: outputPath, args: installArgs })
    await eachOfLimitProgress(
      uninstallTargetsToBeUninstalled,
      target => target.postUninstall(),
      percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Uninstalling plugins ${50 + (percentage / 2)}% complete`)
    )
  }
  logger?.log(`${chalk.bold.cyan('<info>')} Uninstalling plugins 100% complete`)
  const installedDependencies = await project.getInstalledDependencies()
  await updateManifest({ project, targets, installedDependencies, isInteractive })
  await summariseUninstallation({ logger, targets })
  return targets
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Target]} options.targets
 */
async function getUninstallTargets ({ logger, project, plugins, isInteractive }) {
  if (typeof plugins === 'string') plugins = [plugins]
  /** whether adapt.json is being used to compile the list of targets to install */
  const isEmpty = !plugins?.length
  if (isEmpty && isInteractive) {
    const shouldContinue = await createPromptTask({
      message: chalk.reset('This command will attempt to uninstall all installed plugins. Do you wish to continue?'),
      type: 'confirm'
    })
    if (!shouldContinue) return
  }

  /** a list of plugin name/version pairs */
  const itinerary = isEmpty
    ? await project.getInstalledDependencies()
    : plugins.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      // Duplicates are removed by assigning to object properties
      itinerary[name] = version
      return itinerary
    }, {})
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}@${version}`)

  /** @type {[Target]} */
  const targets = pluginNames
    ? pluginNames.map(nameVersion => {
      const [name] = nameVersion.split(/[#@]/)
      return new Target({ name, project, logger })
    })
    : await project.getUninstallTargets()
  return targets
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Target]} options.targets
 */
async function loadPluginData ({ logger, targets }) {
  await eachOfLimitProgress(
    targets,
    target => target.fetchProjectInfo(),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await eachOfLimitProgress(
    targets,
    target => target.markUninstallable(),
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Marking uninstallable ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Marking uninstallable 100% complete`)
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Target]} options.targets
 * @returns
 */
async function updateManifest ({ project, targets, installedDependencies, isInteractive }) {
  if (targets.filter(target => target.isToBeUninstalled).length === 0) return
  if (intersection(Object.keys(installedDependencies), targets.map(target => target.packageName)).length) return
  if (isInteractive) {
    const shouldUpdate = await createPromptTask({
      message: chalk.white('Update the manifest (adapt.json)?'),
      type: 'confirm',
      default: true
    })
    if (!shouldUpdate) return
  }
  targets.forEach(target => target.isToBeUninstalled && project.remove(target))
}

/**
 * @param {Object} options
 * @param {[Target]} options.targets
 */
function summariseUninstallation ({ logger, targets }) {
  const uninstallSucceeded = targets.filter(target => target.isUninstallSuccessful)
  const uninstallSkipped = targets.filter(target => !target.isToBeUninstalled || target.isSkipped)
  const uninstallErrored = targets.filter(target => target.isUninstallFailure)
  const missing = targets.filter(target => target.isMissing)
  const noneUninstalled = (uninstallSucceeded.length === 0)
  const allUninstalledSuccessfully = (uninstallErrored.length === 0 && missing.length === 0)
  const someUninstalledSuccessfully = (!noneUninstalled && !allUninstalledSuccessfully)
  summarise(logger, uninstallSkipped, packageNamePrinter, 'The following plugins were skipped:')
  summarise(logger, missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  summarise(logger, uninstallErrored, errorPrinter, 'The following plugins could not be uninstalled:')
  if (noneUninstalled) logger?.log(chalk.cyanBright('None of the requested plugins could be uninstalled'))
  else if (allUninstalledSuccessfully) summarise(logger, uninstallSucceeded, packageNamePrinter, 'All requested plugins were successfully uninstalled. Summary of uninstallation:')
  else if (someUninstalledSuccessfully) summarise(logger, uninstallSucceeded, packageNamePrinter, 'The following plugins were successfully uninstalled:')
}

function summarise (logger, list, iterator, header) {
  if (!list || !iterator || list.length === 0) return
  logger?.log(chalk.cyanBright(header))
  list.forEach(item => iterator(item, logger))
}
