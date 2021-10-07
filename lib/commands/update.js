import bower from 'bower'
import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import { difference, isBoolean } from 'lodash-es'
import path from 'path'
import Q from 'q'
import semver from 'semver'
import { readValidateJSONSync } from '../util/JSONReadValidate.js'
import Plugin from '../integration/Plugin.js'
import Project from '../integration/Project.js'
import { promiseAllSerialize } from '../util/promises.js'
import Errors from '../util/errors.js'
import readline from 'readline'
// import { BOWER_REGISTRY_URL, getPluginInfo } from '../integration/PackageManagement.js'

function updateBowerRepo (plugin, options, config) {
  const deferred = Q.defer()

  function onSuccess () {
    // console.log('onSuccess');
    deferred.notify()
    deferred.resolve({ updated: true })
  }

  function onFail (err) {
    console.log('onFail', err)
    deferred.notify()
    deferred.resolve({ updated: false, error: err })
  }

  function onLog (obj) {
    // console.log(chalk.cyan(obj.level), obj.id, obj.message);
  }

  try {
    // console.log('UPDATE', plugin.packageName, config);
    bower.commands.update([plugin.packageName], options, config).on('end', onSuccess).on('error', onFail).on('log', onLog)
  } catch (err) {
    console.log('bower update threw error')
    onFail(err)
  }

  return deferred.promise
}

// # Assumptions

// All plugins are from Adapt ecosystem ("adapt-")
// As normal, .bowerrc will be read if present - this should point to a single Adapt registry

// # Tasks

// 1. Consider remove `project` and instead just store framework version

// standard output
let logger
// our temporary bower manifest
let bowerJSON
// a representation of the Adapt project we are going to update
let project
// the plugins to update (`Plugin` instances) with the target version
let plugins
// whether to summarise installed plugins without modifying anything
let isCheck = false
// whether to output debugging information or not
let isDebuggingEnabled = false
// when a bower command errors this is the maximum number of attempts the command will be repeated
const bowerCmdMaxTry = 5
let installedPlugins
// whether this command is being performed on the command line
let isInteractive = true

export function api (pluginName, cwd) {
  isInteractive = false

  process.chdir(cwd)

  clean()

  bowerJSON = { name: 'manifest', dependencies: {} }
  project = new Project()
  plugins = []
  installedPlugins = {}

  if (!project.containsManifestFile) {
    return Q.reject(Errors.ERROR_COURSE_DIR)
  }

  const args = pluginName ? [pluginName] : ['all']

  discoverPlugins()

  return Q(args)
    .then(createManifestFromArguments)
    .then(checkRedundancy)
    .then(createPlugins)
    .then(determineTargetVersions)
    .then(checkIncompatible)
    .then(performUpdates)
    .then(verifyChanged)
    .then(printUpdateSummary)
    .finally(clean)
}

export default function update (logger) {
  const args = [].slice.call(arguments, 1)
  const done = args.pop() || function () {}

  logger = logger

  clean()

  bowerJSON = { name: 'manifest', dependencies: {} }
  project = new Project()
  plugins = []
  installedPlugins = {}

  // bower.commands.info('adapt-contrib-media').on('end', function() {console.log(arguments)})

  const checkArgIndex = args.indexOf('--check')
  const debugArgIndex = args.indexOf('--debug')

  if (checkArgIndex >= 0) {
    args.splice(checkArgIndex, 1)
    isCheck = true
  }

  if (debugArgIndex >= 0) {
    args.splice(checkArgIndex, 1)
    isDebuggingEnabled = true
  }

  discoverPlugins()

  if (isCheck) {
    init(args)
      .then(checkRedundancy)
      .then(createPlugins)
      .then(determineTargetVersions)
      .then(printCheckSummary)
      .then(done)
      .fail(reportFailure(logger, done))
  } else {
    init(args)
      .then(checkRedundancy)
      .then(createPlugins)
      .then(determineTargetVersions)
      .then(checkMissing)
      .then(promptToUpdateIncompatible)
      .then(performUpdates)
      .then(verifyChanged)
      .then(printUpdateSummary)
      .then(done)
      .fail(reportFailure(logger, done))
      .finally(clean)
  }
}

function discoverPlugins () {
  discoverNamedGroup('components')
  discoverNamedGroup('extensions')
  discoverNamedGroup('menu')
  discoverNamedGroup('theme')

  function discoverNamedGroup (group) {
    const srcpath = path.join(process.cwd(), 'src', group)

    if (!fs.existsSync(srcpath)) return

    fs.readdirSync(srcpath).forEach(function (f) {
      const pluginPath = path.join(srcpath, f)
      const bowerPath = path.join(pluginPath, 'bower.json')
      let bowerManifest

      if (fs.lstatSync(pluginPath).isDirectory() && fs.existsSync(bowerPath)) {
        bowerManifest = readValidateJSONSync(bowerPath)
        if (bowerManifest.name) {
          installedPlugins[bowerManifest.name] = { manifest: bowerManifest, group: group }
        }
      }
    })
  }
}

function addSelectedPlugins (arr) {
  const groups = ['all', 'components', 'extensions', 'menu', 'theme']
  const selectedGroups = []

  // record which groups are found and remove from list, taking care to avoid duplicates
  arr = arr.filter(function (item) {
    if (groups.indexOf(item) !== -1) {
      if (selectedGroups.indexOf(item) === -1) selectedGroups.push(item)
      return false
    }
    return true
  })

  if (selectedGroups.indexOf('all') !== -1) {
    addAllPlugins()
  } else {
    // add components, extensions, menus etc
    selectedGroups.forEach(addPluginsFromGroup)
    // add individual plugins
    arr.forEach(addPlugin)
  }
}

function getPluginNames (group) {
  return Object.keys(installedPlugins).filter(k => installedPlugins[k].group === group)
}

function addPlugin (arg) {
  const tokens = arg.split(/[#@]/)
  const name = tokens[0]
  const version = tokens[1]

  if (!installedPlugins[name]) return

  switch (tokens.length) {
    case 1: bowerJSON.dependencies[name] = '*'; break
    case 2: bowerJSON.dependencies[name] = version; break
    default:
  }
}

function addPluginsFromGroup (group) {
  const all = !group || group === 'all'

  if (group === 'components' || all) getPluginNames('components').forEach(addPlugin)
  if (group === 'extensions' || all) getPluginNames('extensions').forEach(addPlugin)
  if (group === 'menu' || all) getPluginNames('menu').forEach(addPlugin)
  if (group === 'theme' || all) getPluginNames('theme').forEach(addPlugin)
}

function addAllPlugins () {
  addPluginsFromGroup()
}

function createManifestFromArguments (args) {
  addSelectedPlugins(args)
}

function init (args) {
  logger?.log()

  if (args.length === 0) {
    if (isCheck) {
      args = ['all']
      return Q(args).then(createManifestFromArguments)
    }

    return createPromptTask({
      message: chalk.reset('This command will attempt to update all installed plugins. Do you wish to continue?'),
      type: 'confirm'
    }).then(function () {
      args = ['all']
      return Q(args).then(createManifestFromArguments)
    })
  }
  // else process arguments
  return Q(args).then(createManifestFromArguments)
}

function checkRedundancy () {
  if (Object.keys(bowerJSON.dependencies).length === 0) {
    if (isInteractive) {
      return Q.reject({ message: 'No valid targets specified (please check spelling and case).' })
    }
    return Q.reject(Errors.ERROR_NOTHING_TO_UPDATE)
  } else {
    return Q.resolve()
  }
}

function createPlugins () {
  debug('createPlugins')

  Object.keys(bowerJSON.dependencies).forEach(function (pluginName) {
    const plugin = Plugin.parse(pluginName + '#' + bowerJSON.dependencies[pluginName])
    plugin._installedVersion = installedPlugins[pluginName].manifest.version
    plugin._versionIndex = 0
    plugin._bowerCmdCount = 0
    plugin._belongsTo = installedPlugins[pluginName].group
    plugins.push(plugin)
  })

  const promiseToGetInfo = []

  for (let i = 0, c = plugins.length; i < c; i++) {
    promiseToGetInfo.push(getInfo(plugins[i]))
  }

  if (!isInteractive) {
    return Q.all(promiseToGetInfo)
  }

  return Q.all(promiseToGetInfo).progress(function () {
    const settled = plugins.filter(function (plugin) { return plugin._bowerInfo || plugin._isMissingAtRepo }).length
    const total = plugins.length
    readline.cursorTo(process.stderr, 0)
    process.stderr.write(chalk.bold.cyan('<info>') + ' Querying server ' + Math.round(100 * settled / total) + '% complete')
  })
    .then(function () {
      process.stderr.write('\n')
    })
}

function determineTargetVersions () {
  // console.log('determineTargetVersions');
  return Q.all(plugins.filter(isPresent).map(getTargetVersion))
}

function getTargetVersion (plugin) {
  plugin._latestVersion = plugin._bowerInfo.version

  // if the plugin has no tags then it is not possible to change version
  if (!plugin._versions || plugin._versions.length === 0) return Q.resolve()

  // if plugin already at latest version then nothing to do
  if (semver.satisfies(plugin._installedVersion, plugin._bowerInfo.version)) {
    // console.log('no update available for', plugin.packageName, plugin._bowerInfo.version);
    plugin._isAtLatestVersion = true
    return Q.resolve()
  }

  // console.log('checking available updates for', plugin.packageName, 'with constraint', plugin.version, '(latest version is '+plugin._bowerInfo.version+')');

  return checkProposedVersion(plugin)
}

function checkProposedVersion (plugin, deferred) {
  deferred = deferred || Q.defer()
  const adaptVersion = project.version
  const satisfiesConstraint = semver.satisfies(plugin._bowerInfo.version, plugin.version)

  // console.log('getting target version for', plugin.packageName, ': checking', plugin._versions[plugin._versionIndex]);

  if (!plugin._isMissingAtRepo) {
    // console.log('plugin not missing, plugin framework requirement is', plugin._bowerInfo.framework, 'installed framework', adaptVersion);
    // check that the proposed plugin is compatible with the installed framework and that it also satisfies any user-provided constraint
    if (semver.satisfies(adaptVersion, plugin._bowerInfo.framework) &&
      satisfiesConstraint) {
      // console.log(plugin.packageName, chalk.green('can'), 'be updated from', plugin._installedVersion, 'to', plugin._bowerInfo.version, '(requires framework '+plugin._bowerInfo.framework+')');
      plugin._proposedVersion = plugin._bowerInfo.version
      plugin._shouldBeUpdated = true
      deferred.resolve()
    } else {
      // console.log(plugin.packageName, chalk.red('cannot'), 'be updated to', plugin._bowerInfo.version, '(requires framework'+plugin._bowerInfo.framework+')');
      if (plugin._versionIndex + 1 < plugin._versions.length && semver.gt(plugin._versions[plugin._versionIndex + 1], plugin._installedVersion)) {
        plugin._versionIndex++
        getInfo(plugin).then(function () {
          checkProposedVersion(plugin, deferred)
        })
      } else {
        deferred.resolve()
      }
    }
  } else {
    deferred.resolve()
  }

  return deferred.promise
}

async function getInfo (plugin, deferred) {
  // presence of deferred signifies a retry
  if (!deferred) this._bowerCmdCount = 0

  deferred = deferred || Q.defer()

  function onSuccess (results) {
    plugin._bowerInfo = results.latest || results
    if (results.versions) plugin._versions = results.versions
    deferred.notify()
    deferred.resolve(results)
  }

  function onFail () {
    reportError()

    if (canRetry()) {
      getInfo(plugin, deferred)
    } else {
      plugin._isMissingAtRepo = true
      deferred.notify()
      deferred.resolve()
    }
  }

  try {
    // console.log('Querying registry for', plugin.packageName, '(' + plugin.version + ')');
    const versionString = plugin._versions ? '#' + plugin._versions[plugin._versionIndex] : ''
    plugin._bowerCmdCount++
    const info = await getPluginInfo(plugin.packageName + versionString)
    onSuccess(info)
  } catch (err) {
    onFail()
  }

  function canRetry () {
    return plugin._bowerCmdCount < bowerCmdMaxTry
  }

  function reportError () {
    if (plugin._bowerCmdCount < bowerCmdMaxTry) {
      debug(chalk.bold.magenta('<debug>'), 'Could not get info for', plugin.packageName + '.', 'Retrying.')
    } else {
      debug(chalk.bold.magenta('<debug>'), 'Could not get info for', plugin.packageName + '.', 'Aborting.')
    }
  }

  return deferred.promise
}

function checkMissing () {
  const missing = plugins.filter(isMissing)

  if (missing.length === 0) {
    return Q.resolve()
  } else if (missing.length === plugins.length) {
    if (missing.length === 1) {
      return Q.reject('The requested plugin was not found at the registry')
    } else {
      return Q.reject('None of the requested plugins were found at the registry')
    }
  } else {
    return promptToListMissing().then(listMissingAndPromptToContinue)
  }
}

function promptToListMissing () {
  return createPromptTask({
    message: chalk.cyan('Some plugins could not be found at the registry. Hit <Enter> for list.'),
    type: 'confirm'
  })
}

function listMissingAndPromptToContinue () {
  const missing = plugins.filter(isMissing)

  missing.forEach(function (plugin) {
    logger?.log(plugin.packageName)
  })

  return createPromptTask({
    message: chalk.cyan('Continue to update other plugins?'),
    type: 'confirm',
    default: true
  })
}

function isMissing (plugin) {
  return plugin._isMissingAtRepo === true
}

function isPresent (plugin) {
  return !isMissing(plugin)
}

function isIncompatible (plugin) {
  return !semver.valid(plugin._proposedVersion)
}

function isToBeUpdated (plugin) {
  return plugin._shouldBeUpdated && !plugin._wasUpdated
}

function isConstrained (plugin) {
  return plugin.version !== '*'
}

function isUntagged (plugin) {
  return !plugin._versions || plugin._versions.length === 0
}

function someOtherVersionSatisfiesConstraint (plugin) {
  const maxSatisfying = semver.maxSatisfying(plugin._versions, plugin.version)
  return maxSatisfying != null && !semver.satisfies(maxSatisfying, plugin._installedVersion)
}

function checkIncompatible () {
  const list = plugins.filter(isPresent).filter(isIncompatible).filter(isConstrained).filter(someOtherVersionSatisfiesConstraint)

  if (list.length === 0) return Q.resolve()

  // const names = list.map(function (p) {
  //   return p.packageName
  // })

  return Q.reject(Errors.ERROR_UPDATE_INCOMPATIBLE)
}

function promptToUpdateIncompatible () {
  // console.log('promptToUpdateIncompatible');
  // const adaptVersion = project.version
  // if there are no compatible updates but the user has requested a specific version (or range) and a corresponding version exists then prompt
  const list = plugins.filter(isPresent).filter(isIncompatible).filter(isConstrained).filter(someOtherVersionSatisfiesConstraint)

  if (list.length === 0) return Q.resolve()

  logger?.log(chalk.bgRed('<warning>'), ' Changes to the following plugins have been requested that will not use the latest compatible version in each case.')

  return promiseAllSerialize(list, function (plugin) {
    // only prompt for plugins that have been requsted with a specific version constraint by the user
    return createPromptTask({
      message: chalk.reset(`Change ${plugin.packageName} to ${semver.maxSatisfying(plugin._versions, plugin.version)}?`),
      type: 'confirm',
      default: false,
      onlyRejectOnError: true
    })
      .then(function (result) {
        plugin._shouldBeUpdated = result
      })
  })
}

function performUpdates () {
  const filtered = plugins.filter(isPresent).filter(isToBeUpdated)

  return promiseAllSerialize(filtered, function (plugin) {
    return createUpdateTask(plugin)
  })
    .then(function () {
      if (isInteractive) renderUpdateProgressFinished()
    })
}

function verifyChanged () {
  plugins.filter(isPresent).forEach(function (plugin) {
    if (!plugin._wasUpdated) return

    const p = path.join(process.cwd(), 'src', plugin._belongsTo, plugin.packageName, 'bower.json')

    plugin._bowerInfo = readValidateJSONSync(p)
    plugin._updatedVersion = plugin._bowerInfo.version
  })

  return Q.resolve()
}

function highlight (str) {
  const sub1 = 'adapt-contrib-'
  const sub2 = 'adapt-'

  if (str.indexOf(sub1) === 0) {
    return chalk.reset(sub1) + chalk.yellowBright(str.substring(sub1.length))
  }

  if (str.indexOf(sub2) === 0) {
    return chalk.reset(sub2) + chalk.yellowBright(str.substring(sub2.length))
  }

  return str
}

function greenIfEqual (v1, v2) {
  const colourFunc = semver.satisfies(v1, v2) ? chalk.greenBright : chalk.magentaBright

  return colourFunc(v2)
}

function printCheckSummary () {
  // console.log('printCheckSummary');

  const present = plugins.filter(isPresent)
  const missing = plugins.filter(isMissing)
  const untagged = difference(present.filter(isUntagged), isMissing)
  const latest = present.filter(function (plugin) { return plugin._isAtLatestVersion })
  const updateAvailable = present.filter(function (plugin) { return plugin._proposedVersion })
  const updateNotAvailable = difference(present.filter(function (plugin) { return !plugin._proposedVersion }), missing, untagged, latest)

  const byPackageName = function (a, b) {
    if (a.packageName < b.packageName) return -1
    if (a.packageName > b.packageName) return 1
    return 0
  }

  logger?.log()

  if (latest.length > 0) logger?.log(chalk.whiteBright('The following plugins are using the latest version:'))

  latest.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)))
  })

  if (latest.length > 0) logger?.log()

  // ************************************

  if (updateAvailable.length > 0) logger?.log(chalk.whiteBright('The following updates can be made:'))

  updateAvailable.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._proposedVersion), '(latest is ' + greenIfEqual(plugin._proposedVersion, plugin._latestVersion) + ')'))
  })

  if (updateAvailable.length > 0) logger?.log()

  // ************************************

  if (updateNotAvailable.length > 0) logger?.log(chalk.whiteBright('The following have no compatible updates:'))

  updateNotAvailable.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion) + ' (latest is ' + chalk.magentaBright(plugin._latestVersion) + ')'))
  })

  if (updateNotAvailable.length > 0) logger?.log()

  // ************************************

  untagged.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.redBright(plugin.packageName, 'has no version tags and so cannot be updated (use adapt install', plugin.packageName, 'to overwrite)'))
  })

  if (untagged.length > 0) logger?.log()

  // ************************************

  missing.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.redBright(plugin.packageName, 'could not be found at the registry'))
  })

  if (missing.length > 0) logger?.log()
}

function printUpdateSummary () {
  if (isInteractive) logger?.log(chalk.bold.cyan('<info>'), 'Operation completed. Update summary:')

  const present = plugins.filter(isPresent)
  const missing = plugins.filter(isMissing)
  const untagged = difference(present.filter(isUntagged), isMissing)
  const errored = present.filter(function (plugin) { return plugin._shouldBeUpdated && !plugin._wasUpdated })
  const updated = present.filter(function (plugin) { return plugin._wasUpdated })
  const latest = present.filter(function (plugin) { return plugin._isAtLatestVersion })
  const userSkipped = difference(present.filter(isConstrained).filter(isIncompatible).filter(someOtherVersionSatisfiesConstraint), updated, errored)
  const incompatibleConstrained = difference(present.filter(isIncompatible).filter(isConstrained), updated, untagged)
  const incompatible = difference(present.filter(isIncompatible), missing, untagged, latest, updated, incompatibleConstrained)

  const byPackageName = function (a, b) {
    if (a.packageName < b.packageName) return -1
    if (a.packageName > b.packageName) return 1
    return 0
  }

  if (!isInteractive) {
    const report = []

    if (plugins.length === 1) {
      const p = plugins[0]

      if (latest.length === 1 || updated.length === 1) {
        const bowerPath = path.join(process.cwd(), 'src', p._belongsTo, p.packageName, 'bower.json')
        return Q.resolve(readValidateJSONSync(bowerPath))
      }
      if (errored.length === 1) {
        const error = Object.assign({}, Errors.ERROR_UPDATE_ERROR)

        if (p._updateError) error.message = p._updateError

        return Q.reject(error)
      }
      if (incompatible.length === 1) {
        return Q.reject(Errors.ERROR_NO_UPDATE)
      }
      if (untagged.length === 1) {
        return Q.reject(Errors.ERROR_NO_RELEASES)
      }

      return Q.reject(Errors.ERROR_NOT_FOUND)
    }

    latest.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'fulfilled',
        pluginData: p._bowerInfo
      })
    })

    updated.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'fulfilled',
        pluginData: p._bowerInfo
      })
    })

    // N.B. there will not be any incompatibleConstrained as this results in a rejected promise

    errored.forEach(function (p) {
      const error = Object.assign({}, Errors.ERROR_UPDATE_ERROR)

      if (p._updateError) error.message = p._updateError

      report.push({
        name: p.packageName,
        status: 'rejected',
        pluginData: p._bowerInfo,
        reason: error
      })
    })

    incompatible.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'rejected',
        pluginData: p._bowerInfo,
        reason: Errors.ERROR_NO_UPDATE
      })
    })

    untagged.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'rejected',
        pluginData: p._bowerInfo,
        reason: Errors.ERROR_NO_RELEASES
      })
    })

    missing.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'rejected',
        pluginData: p._bowerInfo,
        reason: Errors.ERROR_NOT_FOUND
      })
    })

    return Q.resolve(report)
  }

  logger?.log()

  if (latest.length > 0) logger?.log(chalk.whiteBright('The following plugins are using the latest version:'))

  latest.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)))
  })

  if (latest.length > 0) logger?.log()

  //* **************************

  if (incompatibleConstrained.length > 0) logger?.log(chalk.whiteBright('The following plugins are using the requested version:'))

  incompatibleConstrained.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)) + '. Latest is', chalk.magentaBright(plugin._latestVersion))
  })

  if (incompatibleConstrained.length > 0) logger?.log()

  //* **************************

  if (incompatible.length > 0) logger?.log(chalk.whiteBright('The following plugins are using the latest compatible version:'))

  incompatible.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName + ' @' + plugin._installedVersion)) + '. Latest is', greenIfEqual(plugin._installedVersion, plugin._latestVersion))
  })

  if (incompatible.length > 0) logger?.log()

  //* **************************

  if (updated.length > 0) logger?.log(chalk.whiteBright('The following updates have been made:'))

  updated.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.reset(highlight(plugin.packageName)), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._updatedVersion) + '.', 'Latest is', greenIfEqual(plugin._updatedVersion, plugin._latestVersion))
  })

  if (updated.length > 0) logger?.log()

  //* **************************

  userSkipped.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.magenta(plugin.packageName, 'was skipped'))
  })

  if (userSkipped.length > 0) logger?.log()

  errored.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.bold.redBright(plugin.packageName, 'could not be updated', '(error code ' + plugin._updateError + ')'))
  })

  if (errored.length > 0) logger?.log()

  untagged.sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.redBright(plugin.packageName, 'has no version tags and so cannot be updated (use adapt install', plugin.packageName, 'to overwrite)'))
  })

  if (untagged.length > 0) logger?.log()

  missing.sort(byPackageName).sort(byPackageName).forEach(function (plugin) {
    logger?.log(chalk.redBright(plugin.packageName, 'could not be found at the registry'))
  })

  return Q.resolve()
}

function clean () {
  if (fs.existsSync(path.join(process.cwd(), 'bower.json'))) {
    fs.unlinkSync(path.join(process.cwd(), 'bower.json'))
  }
  return Q.resolve()
}

function createUpdateTask (plugin) {
  // console.log(plugin.packageName, 'is missing', !!plugin._isMissingAtRepo, 'is ignored',!plugin._shouldBeUpdated);

  return Q.when(null, function () {
    const deps = {}

    // create bower.json with a single dependency, otherwise bower will install things incorrectly
    deps[plugin.packageName] = plugin._proposedVersion || plugin.version
    const manifest = Object.assign({}, bowerJSON, { dependencies: deps })

    // console.log('manifest\n', JSON.stringify(manifest, null, 4));
    fs.writeJSONSync(path.join(process.cwd(), 'bower.json'), manifest, { spaces: 2, replacer: null })
    // console.log(JSON.stringify(readValidateJSONSync('bower.json'), null, 4));
    return updateBowerRepo(plugin, null, {
      directory: path.join('src', plugin._belongsTo),
      registry: BOWER_REGISTRY_URL,
      cwd: process.cwd(),
      force: true
    })
      .then(function (result) {
        // console.log(result.updated, result.error ? 'error code: '+result.error.code : 'no error')
        plugin._wasUpdated = result.updated
        if (result.error) plugin._updateError = result.error.code
        if (isInteractive) renderUpdateProgress()
      })
  })
}

function createPromptTask (params) {
  const deferred = Q.defer()
  const defaultConfig = {
    name: 'question',
    onlyRejectOnError: false
  }
  const config = Object.assign({}, defaultConfig, params)
  const schema = [config]
  inquirer.prompt(schema).then(confirmation => {
    if (!config.onlyRejectOnError && !confirmation.question) deferred.reject(new Error('Aborted. Nothing has been updated.'))
    deferred.resolve(confirmation.question)
  }).catch(err => deferred.reject(err))
  return deferred.promise
}

function renderUpdateProgress () {
  const list = plugins.filter(function (plugin) { return !plugin._isMissingAtRepo && plugin._shouldBeUpdated })
  const settled = plugins.filter(function (plugin) { return isBoolean(plugin._wasUpdated) }).length
  const total = list.length
  // console.log('progress', settled, total);
  readline.cursorTo(process.stderr, 0)
  process.stderr.write(chalk.bold.cyan('<info>') + ' Updates ' + Math.round(100 * settled / total) + '% complete')
}

function renderUpdateProgressFinished () {
  process.stderr.write('\n')
}

function debug () {
  if (isDebuggingEnabled) {
    logger?.debug.apply(logger, arguments)
  }
}

function reportFailure (logger, done) {
  return function (err) {
    logger?.log(chalk.redBright(err.message))
    done(err)
  }
}
