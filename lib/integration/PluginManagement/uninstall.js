
import chalk from 'chalk'
import Project from '../Project.js'
// import UninstallTarget from './UninstallTarget.js'
import Plugin from '../Plugin.js'
import { promiseAllProgress } from '../../util/promises.js'
import { createPromptTask } from '../../util/createPromptTask.js'
import { errorPrinter, packageNamePrinter } from './print.js'
import { intersection } from 'lodash-es'

export default async function uninstall ({
  plugins,
  cwd = process.cwd(),
  logger = null
}) {
  const project = new Project({ cwd, logger })
  project.throwInvalid()

  logger?.log(chalk.cyan('uninstalling adapt dependencies...'))

  const uninstallTargets = await getUninstallTargets({ logger, project, plugins })
  if (!uninstallTargets?.length) return

  await loadPluginData({ logger, plugins: uninstallTargets })
  await promiseAllProgress({
    promises: uninstallTargets.filter(plugin => plugin.isToBeUninstalled).map(plugin => plugin.uninstall()),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Uninstalling plugins ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Uninstalling plugins 100% complete`)
  await updateManifest({ project, plugins: uninstallTargets, installedDependencies: await project.getInstalledDependencies() })
  return summariseUninstallation({ logger, plugins: uninstallTargets })
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 */
async function getUninstallTargets ({ logger, project, plugins }) {
  /** whether adapt.json is being used to compile the list of plugins to install */
  const isEmpty = !plugins?.length
  if (isEmpty) {
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
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)

  /** @type {[Plugin]} */
  const uninstallTargets = pluginNames
    ? pluginNames.map(name => {
      return new Plugin({ name, project, logger })
    })
    : await project.getUninstallTargets()
  return uninstallTargets
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 */
async function loadPluginData ({ logger, plugins }) {
  await promiseAllProgress({
    promises: plugins.map(plugin => plugin.fetchProjectInfo()),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await promiseAllProgress({
    promises: plugins.map(plugin => plugin.markUninstallable()),
    progress: percentage => logger?.logProgress(`${chalk.bold.cyan('<info>')} Marking uninstallable ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking uninstallable 100% complete`)
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[Plugin]} options.plugins
 * @returns
 */
async function updateManifest ({ project, plugins, installedDependencies }) {
  if (plugins.filter(plugin => plugin.isToBeUninstalled).length === 0) return
  if (intersection(Object.keys(installedDependencies), plugins.map(plugin => plugin.packageName)).length) return
  const shouldUpdate = await createPromptTask({
    message: chalk.white('Update the manifest (adapt.json)?'),
    type: 'confirm',
    default: true
  })
  if (!shouldUpdate) return
  plugins.forEach(plugin => plugin.isToBeUninstalled && project.remove(plugin))
}

/**
 * @param {object} param0
 * @param {[Plugin]} param0.plugins
 */
function summariseUninstallation ({ logger, plugins }) {
  const uninstallSucceeded = plugins.filter(plugin => plugin.isUninstallSuccessful)
  const uninstallSkipped = plugins.filter(plugin => !plugin.isToBeUninstalled || plugin.isSkipped)
  const uninstallErrored = plugins.filter(plugin => plugin.isUninstallFailure)
  const missing = plugins.filter(plugin => plugin.isMissing)
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
  list.forEach(iterator)
}
