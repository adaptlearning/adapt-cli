
import chalk from 'chalk'
import Errors from '../../util/errors.js'
import Project from '../Project.js'
import UninstallTarget from '../PackageManagement/UninstallTarget.js'
import { promiseAllProgress } from '../../util/promises.js'
import { readValidateJSONSync } from '../../util/JSONReadValidate.js'
import path from 'path'
import { createPromptTask } from '../../util/createPromptTask.js'

export default async function uninstallPlugins ({
  pluginNames,
  localDir = process.cwd(),
  logger = null,
  isUsingManifest = undefined
}) {
  if (typeof pluginNames === 'string') pluginNames = [pluginNames]

  const project = new Project({ localDir, logger })
  logger?.log(chalk.cyan('uninstalling adapt dependencies...'))

  /** @type {[UninstallTarget]} */
  const plugins = pluginNames
    ? pluginNames.map(name => {
      return new UninstallTarget({ name, project })
    })
    : project.uninstallTargets

  await loadPluginData(logger, plugins)
  await promiseAllProgress(plugins.filter(plugin => plugin.isToBeUninstalled).map(plugin => plugin.uninstall()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Uninstalling plugins ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Uninstalling plugins 100% complete`)
  if (!isUsingManifest) await updateManifest({ project, plugins })
  return summariseUninstallation({ plugins, isInteractive: true })
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

function summariseUninstallation ({ plugins, isInteractive }) {
  // console.log('install::summariseUninstallation');
  const uninstallSucceeded = plugins.filter(plugin => plugin.isUninstallSuccessful)
  const uninstallErrored = plugins.filter(plugin => plugin.isUninstallFailure)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const allSuccess = 'All requested plugins were successfully uninstalled. Summary of installation:'
  const someSuccess = 'The following plugins were successfully uninstalled:'
  const noSuccess = 'None of the requested plugins could be uninstalled'
  let successMsg
  if (!isInteractive) {
    const report = []
    const hasInstalledOnePlugin = (plugins.length === 1)
    if (hasInstalledOnePlugin) {
      const plugin = plugins[0]
      if (uninstallSucceeded.length === 1) {
        const bowerPath = path.join(process.cwd(), 'src', plugin._belongsTo, plugin.packageName, 'bower.json')
        return readValidateJSONSync(bowerPath)
      }
      if (uninstallErrored.length === 1) {
        const error = Object.assign({}, Errors.ERROR_INSTALL_ERROR)
        if (plugin._installError) error.message = plugin._installError
        throw new Error(error)
      }
      throw new Error(Errors.ERROR_NOT_FOUND)
    }
    uninstallSucceeded.forEach(plugin => report.push({
      name: plugin.packageName,
      status: 'fulfilled',
      pluginData: readValidateJSONSync(path.join(process.cwd(), 'src', plugin._belongsTo, plugin.packageName, 'bower.json'))
    }))
    uninstallErrored.forEach(plugin => {
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
  if (uninstallErrored.length === 0 && missing.length === 0) successMsg = allSuccess
  else if (uninstallSucceeded.length === 0) console.log(chalk.cyanBright(noSuccess))
  else successMsg = someSuccess
  summarise(uninstallSucceeded, packageNamePrinter, successMsg)
  summarise(uninstallErrored, installErroredPrinter, 'The following plugins could not be uninstalled:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')
  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return
    console.log(chalk.cyanBright(header))
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
    default: true,
    onlyRejectOnError: true
  })
  if (!shouldUpdate) return
  plugins.forEach(plugin => plugin.isToBeUninstalled && project.remove(plugin))
}

// output formatting

function highlight (str) {
  return ['adapt-contrib', 'adapt-'].reduce((output, prefix) => {
    if (output || !str.startsWith(prefix)) return output
    return chalk.reset(prefix) + chalk.yellowBright(str.substring(prefix.length))
  }, null) || str
}

function packageNamePrinter (plugin) {
  console.log(highlight(plugin.packageName))
}

function installErroredPrinter (plugin) {
  console.log(highlight(plugin.packageName), plugin._installError ? '(error: ' + plugin._installError + ')' : '(unknown error)')
}
