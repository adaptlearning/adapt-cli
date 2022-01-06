import chalk from 'chalk'
import Project from '../Project.js'
import { createPromptTask } from '../../util/createPromptTask.js'
import semver from 'semver'
import { promiseAllProgress, forEachPromise } from '../../util/promises.js'
import { difference } from 'lodash-es'
import { highlight, greenIfEqual } from './print.js'
// # Assumptions

// All plugins are from Adapt ecosystem ("adapt-")
// As normal, .bowerrc will be read if present - this should point to a single Adapt registry

export default async function update ({
  plugins,
  localDir = process.cwd(),
  logger = null,
  // whether to summarise installed plugins without modifying anything
  isDryRun = false
}) {
  const project = new Project({ localDir, logger })
  project.throwInvalid()
  if (typeof plugins === 'string') plugins = [plugins]

  logger?.log(chalk.cyan('update adapt dependencies...'))

  // TODO: sort out where these inputs get handled, with duplicate resolution etc
  const allowedTypes = ['all', 'components', 'extensions', 'menu', 'theme']
  const selectedTypes = [...new Set(plugins.filter(type => allowedTypes.includes(type)))]
  const isEmpty = (!plugins.length)
  const isAll = (isDryRun || isEmpty || selectedTypes.includes('all'))
  const pluginNames = plugins.filter(name => !allowedTypes.includes(name))
  /**
   * @type {[UpdateTarget]}
   */
  let updateTargets = project.updateTargets
  if (!isDryRun && isEmpty) {
    const shouldContinue = await createPromptTask({
      message: chalk.reset('This command will attempt to update all installed plugins. Do you wish to continue?'),
      type: 'confirm'
    })
    if (!shouldContinue) return
  }
  if (!isAll) {
    // TODO make sure to pass in requested version / range etc
    const filtered = []
    for (const plugin of updateTargets) {
      const type = await plugin.getType()
      if (!type) continue
      const isPluginNameIncluded = pluginNames.some(name => plugin.isNameMatch(name))
      const isTypeIncluded = selectedTypes.includes(type.belongsTo)
      if (!isPluginNameIncluded && !isTypeIncluded) continue
      filtered.push(plugin)
    }
    updateTargets = filtered
  }

  const isNothingToUpdate = (!updateTargets.length)
  if (isNothingToUpdate) {
    return { message: 'No valid targets specified (please check spelling and case).' }
  }

  try {
    const frameworkVersion = project.version
    await loadPluginData(logger, frameworkVersion, updateTargets)
    if (isDryRun) {
      await printCheckSummary(logger, updateTargets)
    } else {
      await checkMissing(logger, updateTargets)
      await promptToUpdateIncompatible(logger, updateTargets)
      await performUpdates(logger, updateTargets)
      await printUpdateSummary(logger, updateTargets)
    }
  } catch (err) {
    console.error(err)
    // logger?.log(chalk.redBright(err.message))
  }
}

async function loadPluginData (logger, frameworkVersion, plugins) {
  await promiseAllProgress(plugins.map(plugin => plugin.getInfo()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  await promiseAllProgress(plugins.map(plugin => plugin.getTargetVersion(frameworkVersion)), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Finding target versions ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Finding target versions 100% complete`)
  await promiseAllProgress(plugins.map(plugin => plugin._shouldBeUpdated && plugin.markUpdateable()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Marking updateable ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking updateable 100% complete`)
}

async function checkMissing (logger, plugins) {
  const missing = plugins.filter(plugin => plugin.isMissing)
  const hasMissing = Boolean(missing.length)
  if (!hasMissing) return
  const isAllMissing = (missing.length === plugins.length)
  const isOnlyOneMissing = (isAllMissing && plugins.length === 1)
  if (isAllMissing && isOnlyOneMissing) throw new Error('The requested plugin was not found at the registry')
  if (isAllMissing) throw new Error('None of the requested plugins were found at the registry')
  await createPromptTask({
    message: chalk.cyan('Some plugins could not be found at the registry. Hit <Enter> for list.'),
    type: 'confirm'
  })
  missing.forEach(plugin => logger?.log(plugin.packageName))
  const shouldContinue = await createPromptTask({
    message: chalk.cyan('Continue to update other plugins?'),
    type: 'confirm',
    default: true
  })
  if (!shouldContinue) throw new Error('')
}

async function promptToUpdateIncompatible (logger, plugins) {
  // if there are no compatible updates but the user has requested
  // a specific version (or range) and a corresponding version exists then prompt
  const list = plugins
    .filter(plugin => plugin.isPresent)
    .filter(plugin => plugin.isIncompatible)
    .filter(plugin => plugin.isConstrained)
    .filter(someOtherVersionSatisfiesConstraint)

  if (list.length === 0) return

  logger?.log(chalk.bgRed('<warning>'), ' Changes to the following plugins have been requested that will not use the latest compatible version in each case.')

  return forEachPromise(list, plugin => {
    // only prompt for plugins that have been requsted with a specific version constraint by the user
    return createPromptTask({
      message: chalk.reset(`Change ${plugin.packageName} to ${semver.maxSatisfying(plugin._versions, plugin.version)}?`),
      type: 'confirm',
      default: false
    }).then(shouldBeUpdated => {
      plugin._shouldBeUpdated = shouldBeUpdated
    })
  })
}

function someOtherVersionSatisfiesConstraint (plugin) {
  const maxSatisfying = semver.maxSatisfying(plugin._versions, plugin.version)
  return maxSatisfying != null && !semver.satisfies(maxSatisfying, plugin._installedVersion)
}

async function performUpdates (logger, plugins) {
  const update = plugins
    .filter(plugin => plugin.isPresent)
    .filter(plugin => plugin.isToBeUpdated)
  await promiseAllProgress(update.map(plugin => plugin.update()), percentage => {
    logger?.logProgress(`${chalk.bold.cyan('<info>')} Updates ${percentage}% complete`)
  })
  logger?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Updates 100% complete`)
  process.stderr.write('\n')
}

function printCheckSummary (logger, plugins) {
  logger?.log(chalk.bold.cyan('<info>'), 'Operation completed. Updates dry-run summary:')
  plugins.sort((a, b) => {
    if (a.packageName < b.packageName) return -1
    if (a.packageName > b.packageName) return 1
    return 0
  })
  const present = plugins.filter(plugin => plugin.isPresent)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const untagged = difference(present.filter(plugin => plugin.isUntagged), missing)
  const latest = present.filter(plugin => plugin._isAtLatestVersion)
  const updateAvailable = present.filter(plugin => plugin._shouldBeUpdated)
  const updateNotAvailable = difference(present.filter(plugin => !plugin._proposedVersion), missing, untagged, latest)

  logger.log()
  const printSummary = createPrinter(logger)
  printSummary({
    title: 'The following plugins are using the latest version:',
    items: latest,
    item: plugin => logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)))
  })
  printSummary({
    title: 'The following updates can be made:',
    items: updateAvailable,
    item: plugin => logger.log(chalk.reset(highlight(plugin.packageName), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._proposedVersion), '(latest is ' + greenIfEqual(plugin._proposedVersion, plugin._latestVersion) + ')'))
  })
  printSummary({
    title: 'The following have no compatible updates:',
    items: updateNotAvailable,
    item: plugin => logger.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion) + ' (latest is ' + chalk.magentaBright(plugin._latestVersion) + ')'))
  })
  printSummary({
    title: 'The following have no version tags and so cannot be updated:',
    items: untagged,
    item: plugin => logger.log(chalk.redBright(plugin.packageName, '(use adapt install', plugin.packageName, 'to overwrite)'))
  })
  printSummary({
    title: 'The following could not be found at the registry:',
    items: untagged,
    item: plugin => logger.log(chalk.redBright(plugin.packageName))
  })
}

function printUpdateSummary (logger, plugins) {
  logger?.log(chalk.bold.cyan('<info>'), 'Operation completed. Update summary:')
  plugins.sort((a, b) => {
    if (a.packageName < b.packageName) return -1
    if (a.packageName > b.packageName) return 1
    return 0
  })
  const present = plugins.filter(plugin => plugin.isPresent)
  const missing = plugins.filter(plugin => plugin.isMissing)
  const untagged = difference(present.filter(plugin => plugin.isUntagged), missing)
  const errored = present.filter(plugin => plugin._shouldBeUpdated && !plugin._wasUpdated)
  const updated = present.filter(plugin => plugin._wasUpdated)
  const latest = present.filter(plugin => plugin._isAtLatestVersion)
  const userSkipped = difference(
    present
      .filter(plugin => plugin.isConstrained)
      .filter(plugin => plugin.isIncompatible)
      .filter(someOtherVersionSatisfiesConstraint),
    updated,
    errored
  )
  const incompatibleConstrained = difference(
    present
      .filter(plugin => plugin.isIncompatible)
      .filter(plugin => plugin.isConstrained),
    updated,
    untagged
  )
  const incompatible = difference(
    present.filter(plugin => plugin.isIncompatible),
    missing,
    untagged,
    latest,
    updated,
    incompatibleConstrained
  )
  logger?.log()
  const printSummary = createPrinter(logger)
  printSummary({
    title: 'The following plugins are using the latest version:',
    items: latest,
    item: plugin => logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)))
  })
  printSummary({
    title: 'The following plugins are using the requested version:',
    items: incompatibleConstrained,
    item: plugin => logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)) + '. Latest is', chalk.magentaBright(plugin._latestVersion))
  })
  printSummary({
    title: 'The following plugins are using the latest compatible version:',
    items: incompatible,
    item: plugin => logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)) + '. Latest is', greenIfEqual(plugin._installedVersion, plugin._latestVersion))
  })
  printSummary({
    title: 'The following updates have been made:',
    items: updated,
    item: plugin => logger?.log(chalk.reset(highlight(plugin.packageName)), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._updatedVersion) + '.', 'Latest is', greenIfEqual(plugin._updatedVersion, plugin._latestVersion))
  })
  printSummary({
    title: 'The following plugins were skipped:',
    items: userSkipped,
    item: plugin => logger?.log(chalk.reset(highlight(plugin.packageName)))
  })
  printSummary({
    title: 'The following plugins were could not be updated:',
    items: errored,
    item: plugin => logger?.log(chalk.bold.redBright(plugin.packageName, '(error code ' + plugin._updateError + ')'))
  })
  printSummary({
    title: 'The following plugins have no version tags and so cannot be updated:',
    items: errored,
    item: plugin => logger?.log(chalk.bold.redBright(plugin.packageName, '(use adapt install', plugin.packageName, 'to overwrite)'))
  })
  printSummary({
    title: 'The following plugins could not be found at the registry:',
    items: errored,
    item: plugin => logger?.log(chalk.bold.redBright(plugin.packageName))
  })
}

function createPrinter (logger) {
  return function printSummary ({ title, items, item }) {
    const hasItems = Boolean(items.length)
    if (!hasItems) return
    logger?.log(chalk.whiteBright(title))
    items.forEach(plugin => item(plugin))
    logger?.log()
  }
}
