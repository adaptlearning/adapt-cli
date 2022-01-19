
import chalk from 'chalk'
import Project from '../Project.js'
import UninstallTarget from './UninstallTarget.js'
import { promiseAllProgress } from '../../util/promises.js'
import { createPromptTask } from '../../util/createPromptTask.js'
import { installErroredPrinter, packageNamePrinter } from './print.js'

export default async function uninstall ({
  plugins,
  localDir = process.cwd(),
  logger = null
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

  logger?.log(chalk.cyan('uninstalling adapt dependencies...'))

  /** @type {[UninstallTarget]} */
  const uninstallTargets = pluginNames
    ? pluginNames.map(name => {
      return new UninstallTarget({ name, project })
    })
    : project.uninstallTargets

  await loadPluginData(logger, uninstallTargets)
  await promiseAllProgress(uninstallTargets.filter(plugin => plugin.isToBeUninstalled).map(plugin => plugin.uninstall()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Uninstalling plugins ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Uninstalling plugins 100% complete`)
  if (!isUsingManifest) await updateManifest({ project, plugins: uninstallTargets })
  return summariseUninstallation({ logger, plugins: uninstallTargets })
}

async function loadPluginData (logger, plugins) {
  await promiseAllProgress(plugins.map(plugin => plugin.getInitialInfo()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await promiseAllProgress(plugins.map(plugin => plugin.markUninstallable()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Marking uninstallable ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking uninstallable 100% complete`)
}

function summariseUninstallation ({ logger, plugins }) {
  // console.log('install::summariseUninstallation');
  const uninstallSucceeded = plugins.filter(plugin => plugin.isUninstallSuccessful)
  const uninstallErrored = plugins.filter(plugin => plugin.isUninstallFailure)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const allSuccess = 'All requested plugins were successfully uninstalled. Summary of installation:'
  const someSuccess = 'The following plugins were successfully uninstalled:'
  const noSuccess = 'None of the requested plugins could be uninstalled'
  const successMsg = (uninstallErrored.length === 0 && missing.length === 0)
    ? allSuccess
    : someSuccess
  if (uninstallSucceeded.length === 0) logger?.log(chalk.cyanBright(noSuccess))
  else summarise(uninstallSucceeded, packageNamePrinter, successMsg)
  summarise(uninstallErrored, installErroredPrinter, 'The following plugins could not be uninstalled:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return
    logger?.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

/**
 * @param {Object} options
 * @param {Project} options.project
 * @param {[UninstallTarget]} options.plugins
 * @returns
 */
async function updateManifest ({ project, plugins }) {
  if (plugins.filter(plugin => plugin.isToBeUninstalled).length === 0) return
  const shouldUpdate = await createPromptTask({
    message: chalk.white('Update the manifest (adapt.json)?'),
    type: 'confirm',
    default: true
  })
  if (!shouldUpdate) return
  plugins.forEach(plugin => plugin.isToBeUninstalled && project.remove(plugin))
}
