// TODO
// - check promise chains
import Cwd from '../Cwd.js'
import {
  DEFAULT_PROJECT_MANIFEST_PATH,
  DEFAULT_PROJECT_FRAMEWORK_PATH,
  BOWER_REGISTRY_URL
} from '../CONSTANTS.js'
import chalk from 'chalk'
import inquirer from 'inquirer'
import bower from 'bower'
import path from 'path'
import rimraf from 'rimraf'
import semver from 'semver'
import Errors from '../errors.js'
import JsonLoader from '../JsonLoader.js'
import { getKeywords } from '../PackageMeta.js'
import Plugin from '../Plugin.js'
import Project from '../Project.js'
import PluginTypeResolver from '../PluginTypeResolver.js'
import { reportInvalidFrameworkDirectory } from '../RendererHelpers.js'
import promiseSerialize from '../promiseSerialize.js'
import InstallTarget from './install/InstallTarget.js'
import InstallLog from './install/InstallLog.js'
import promiseAllProgress from '../promiseAllProgress.js'

// a representation of the target Adapt project
let project
// a list of plugin name/version pairs
let itinerary
// the plugins to install (`Plugin` instances)
let plugins
// whether to summarise installation without modifying anything
let isDryRun = false
// whether to target the latest compatible version for all plugin installations (overrides constraints)
let isCompatibleEnabled = false
// whether adapt.json is being used to compile the list of plugins to install
let isUsingManifest = false
// whether this command is being performed on the command line
let isInteractive = true

export async function api (pluginName, cwd) {
  isInteractive = false

  Cwd(cwd)

  project = new Project(DEFAULT_PROJECT_MANIFEST_PATH(), DEFAULT_PROJECT_FRAMEWORK_PATH())

  if (!project.isProjectContainsManifestFile()) {
    throw new Error({ error: Errors.ERROR_COURSE_DIR })
  }

  itinerary = {}
  plugins = []

  init(pluginName ? [pluginName] : [])
  createPlugins()
  await getInitialInfo()
  await findCompatibleVersions()
  await checkConstraints()
  await createInstallationManifest()
  await performInstallation()
  return summariseInstallation()
}

export default async function install (renderer) {
  const args = [].slice.call(arguments, 1)

  project = new Project(DEFAULT_PROJECT_MANIFEST_PATH(), DEFAULT_PROJECT_FRAMEWORK_PATH())

  if (!project.isProjectContainsManifestFile()) {
    reportInvalidFrameworkDirectory(renderer)
    return
  }

  itinerary = {}
  plugins = []

  const dryRunArgIndex = args.indexOf('--dry-run')
  const compatibleArgIndex = args.indexOf('--compatible')

  if (dryRunArgIndex >= 0) {
    args.splice(dryRunArgIndex, 1)
    isDryRun = true
  }

  if (compatibleArgIndex >= 0) {
    args.splice(compatibleArgIndex, 1)
    isCompatibleEnabled = true
  }

  if (isDryRun) {
    init(args)
    createPlugins()
    await getInitialInfo()
    await findCompatibleVersions()
    await checkConstraints()
    await createInstallationManifest()
    summariseDryRun()
  } else {
    init(args)
    createPlugins()
    getInitialInfo()
    await getInitialInfo()
    await findCompatibleVersions()
    await checkConstraints()
    await createInstallationManifest()
    await performInstallation()
    await updateManifest()
    return summariseInstallation()
  }
}

function init (args) {
  if (args.length === 0) {
    getItineraryFromManifest()
  } else {
    getItineraryFromArguments(args)
  }
}

function getItineraryFromManifest () {
  isUsingManifest = true

  itinerary = JsonLoader.readJSONSync(DEFAULT_PROJECT_MANIFEST_PATH()).dependencies
}

function getItineraryFromArguments (args) {
  isUsingManifest = false

  args.forEach(function (arg) {
    const tokens = arg.split(/[#@]/)
    const name = tokens[0]
    const version = tokens[1]

    switch (tokens.length) {
      case 1: itinerary[name] = '*'; break
      case 2: itinerary[name] = version; break
      default:
    }
  })
}

async function createPlugins () {
  Object.keys(itinerary).forEach(function (name) {
    const plugin = new InstallTarget(name, itinerary[name], isCompatibleEnabled)
    plugins.push(plugin)
  })
}

function getInitialInfo () {
  // console.log('install::getInitialInfo');

  const promises = []

  for (let i = 0, c = plugins.length; i < c; i++) {
    promises.push(plugins[i].getInitialInfo())
  }

  if (isInteractive) {
    return promiseAllProgress(promises, progressUpdate).then(conclude)
  }

  return Promise.all(promises)

  function progressUpdate (percentage) {
    // const settled = plugins.filter(function (plugin) { return plugin._rawInfo || plugin._isMissingAtRepo }).length
    // const total = plugins.length
    InstallLog.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  }

  function conclude () {
    InstallLog.logProgressConclusion(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  }
}

function findCompatibleVersions () {
  // console.log('install::findCompatibleVersions');

  const promises = []
  const present = plugins.filter(isPresent)

  for (let i = 0, c = present.length; i < c; i++) {
    promises.push(present[i].findCompatibleVersion(project.getFrameworkVersion()))
  }

  if (isInteractive) {
    return promiseAllProgress(promises, progressUpdate).then(conclude)
  }

  return Promise.all(promises)

  function progressUpdate () {
    const settled = present.filter(function (plugin) { return plugin._latestCompatibleVersion !== undefined }).length
    const total = present.length
    InstallLog.logProgress(chalk.bold.cyan('<info>') + ' Finding compatible versions ' + Math.round(100 * settled / total) + '% complete')
  }

  function conclude () {
    InstallLog.logProgressConclusion(chalk.bold.cyan('<info>') + ' Finding compatible versions 100% complete')
  }
}

function checkConstraints () {
  // console.log('install::checkConstraints');

  const promises = []
  const present = plugins.filter(isPresent)

  for (let i = 0, c = present.length; i < c; i++) {
    promises.push(present[i].checkConstraint(project.getFrameworkVersion()))
  }

  if (isInteractive) {
    return promiseAllProgress(promises, progressUpdate).then(conclude)
  }

  return Promise.all(promises)

  function progressUpdate () {
    const settled = present.filter(function (plugin) { return plugin._constraintChecked !== undefined }).length
    const total = present.length
    InstallLog.logProgress(chalk.bold.cyan('<info>') + ' Checking constraints ' + Math.round(100 * settled / total) + '% complete')
  }

  function conclude () {
    InstallLog.logProgressConclusion(chalk.bold.cyan('<info>') + ' Checking constraints 100% complete')
  }
}

function getPromptIncompatibleGeneric (p) {
  return createPromptTask({
    message: chalk.reset(p.packageName),
    choices: [
      { name: 'latest version', value: 'l' },
      { name: 'skip', value: 's' }
    ],
    type: 'list',
    default: 's',
    onlyRejectOnError: true
  })
    .then(function (result) {
      const installLatest = result === 'l'

      if (installLatest) p.markLatestForInstallation()
    })
}

function getPromptCompatibleWithOldIncompatibleConstraint (p) {
  return createPromptTask({
    message: chalk.white(p.packageName),
    choices: [
      {
        name: `requested version [${semver.maxSatisfying(p._versions, p.version)}]`,
        value: 'r'
      },
      {
        name: `latest compatible version [${p._latestCompatibleVersion}]`,
        value: 'l'
      },
      {
        name: 'skip',
        value: 's'
      }
    ],
    type: 'list',
    default: 's',
    onlyRejectOnError: true
  })
    .then(function (result) {
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'

      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    })
}

function getPromptCompatibleWithOldCompatibleConstraint (p) {
  return createPromptTask({
    message: chalk.white(p.packageName),
    choices: [
      {
        name: `requested version [${p._resolvedConstraint}]`,
        value: 'r'
      },
      {
        name: `latest compatible version [${p._latestCompatibleVersion}]`,
        value: 'l'
      },
      {
        name: 'skip',
        value: 's'
      }
    ],
    type: 'list',
    default: 's',
    onlyRejectOnError: true
  })
    .then(function (result) {
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'

      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    })
}

function getPromptCompatibleWithNewCompatibleConstraint (p) {
  return createPromptTask({
    message: chalk.white(p.packageName),
    choices: [
      {
        name: `requested version [${p._resolvedConstraint}]`,
        value: 'r'
      },
      {
        name: `latest compatible version [${p._latestCompatibleVersion}]`,
        value: 'l'
      },
      {
        name: 'skip',
        value: 's'
      }
    ],
    type: 'list',
    default: 's',
    onlyRejectOnError: true
  })
    .then(function (result) {
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'

      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    })
}

function getPromptCompatibleWithBadConstraint (p) {
  return createPromptTask({
    message: chalk.white(p.packageName),
    type: 'list',
    choices: [
      {
        name: `compatible version [${p._latestCompatibleVersion}]`,
        value: 'c'
      },
      {
        name: 'skip',
        value: 's'
      }
    ],
    default: 's',
    onlyRejectOnError: true
  })
    .then(function (result) {
      const installLatestCompatible = result === 'c'

      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    })
}

function getPromptCompatibleWithUnmetConstraint (p) {
  return createPromptTask({
    message: chalk.white(p.packageName),
    choices: [
      {
        name: `requested version [${semver.maxSatisfying(p._versions, p.version)}]`,
        value: 'r'
      },
      {
        name: `latest compatible version [${p._latestCompatibleVersion}]`,
        value: 'l'
      },
      {
        name: 'skip',
        value: 's'
      }
    ],
    type: 'list',
    default: 's',
    onlyRejectOnError: true
  })
    .then(function (result) {
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'

      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    })
}

function createInstallationManifest () {
  // console.log('install::createInstallationManifest');

  const present = plugins.filter(isPresent)

  const verifiedForInstallation = present.filter(isVerifiedForInstallation)

  verifiedForInstallation.forEach(function (p) { p.markLatestCompatibleForInstallation() })

  // there is no compatible version, but the user requested a valid version which is not the latest (prompt for (r)equested, (l)atest or (s)kip)
  const incompatibleWithOldConstraint = present.filter(isIncompatibleWithOldConstraint)
  // there is no compatible version, but the user requested the latest version (prompt for (l)atest or (s)kip)
  const incompatibleWithLatestConstraint = present.filter(isIncompatibleWithLatestConstraint)
  // there is no compatible version, but the user requested an invalid version (prompt for (l)atest or (s)kip)
  const incompatibleWithBadConstraint = present.filter(isIncompatibleWithBadConstraint)
  // there is no compatible version and no constraint was given (prompt for (l)atest or (s)kip)
  const incompatibleWithNoConstraint = present.filter(isIncompatibleWithNoConstraint)

  // a compatible version exists but the user requested an older version that isn't compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
  const compatibleWithOldIncompatibleConstraint = present.filter(isCompatibleWithOldIncompatibleConstraint)
  // a compatible version exists but the user requested an older version that is compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
  const compatibleWithOldCompatibleConstraint = present.filter(isCompatibleWithOldCompatibleConstraint)
  // a compatible version exists but the user requested a newer version that is compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
  const compatibleWithNewCompatibleConstraint = present.filter(isCompatibleWithNewCompatibleConstraint)
  // a compatible version exists but the user gave a bad constraint (prompt for (c)ompatible or (s)kip)
  const compatibleWithBadConstraint = present.filter(isCompatibleWithBadConstraint)
  // a compatible version exists but user has requested a valid version that is later than the latest compatible version (prompt for (r)equested, (l)atest compatible or (s)kip)
  const compatibleWithUnmetConstraint = present.filter(isCompatibleWithUnmetConstraint)

  if (!isInteractive) {
    incompatibleWithOldConstraint.forEach(function (p) {
      p._error = Errors.ERROR_INCOMPATIBLE_VALID_REQUEST
    })
    incompatibleWithLatestConstraint.forEach(function (p) {
      p._error = Errors.ERROR_INCOMPATIBLE_VALID_REQUEST
    })
    incompatibleWithBadConstraint.forEach(function (p) {
      p._error = Errors.ERROR_INCOMPATIBLE_BAD_REQUEST
    })
    incompatibleWithNoConstraint.forEach(function (p) {
      p._error = Errors.ERROR_INCOMPATIBLE
    })
    compatibleWithOldIncompatibleConstraint.forEach(function (p) {
      p._error = Errors.ERROR_COMPATIBLE_INC_REQUEST
    })
    compatibleWithBadConstraint.forEach(function (p) {
      p._error = Errors.ERROR_COMPATIBLE_BAD_REQUEST
    })
    compatibleWithUnmetConstraint.forEach(function (p) {
      p._error = Errors.ERROR_COMPATIBLE_INC_REQUEST
    })

    compatibleWithOldCompatibleConstraint.forEach(function (p) {
      p.markRequestedForInstallation()
    })

    compatibleWithNewCompatibleConstraint.forEach(function (p) {
      p.markRequestedForInstallation()
    })
  }

  const allPromises = []

  add(incompatibleWithOldConstraint, 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric)

  add(incompatibleWithLatestConstraint, 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric)

  add(incompatibleWithBadConstraint, 'An invalid constraint was given, but there is no compatible version of the following plugins:', getPromptIncompatibleGeneric)

  add(incompatibleWithNoConstraint, 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric)

  add(compatibleWithOldIncompatibleConstraint, 'An older incompatible version has been requested for the following plugins:', getPromptCompatibleWithOldIncompatibleConstraint)

  add(compatibleWithOldCompatibleConstraint, 'A compatible but older version has been requested for the following plugins:', getPromptCompatibleWithOldCompatibleConstraint)

  add(compatibleWithNewCompatibleConstraint, 'A compatible but newer version has been requested for the following plugins:', getPromptCompatibleWithNewCompatibleConstraint)

  add(compatibleWithBadConstraint, 'An invalid constraint was given but a compatible version exists for the following plugins:', getPromptCompatibleWithBadConstraint)

  add(compatibleWithUnmetConstraint, 'The requested version is incompatible but a compatible version exists for the following plugins:', getPromptCompatibleWithUnmetConstraint)

  if (allPromises.length === 0) return

  return promiseSerialize(allPromises, execute)

  function add (list, header, prompt) {
    if (list.length > 0) {
      allPromises.push({
        header: chalk.cyan('<info> ') + header,
        list: list,
        prompt: prompt
      })
    }
  }

  function execute (obj) {
    console.log(obj.header)
    return promiseSerialize(obj.list, obj.prompt)
  }
}

function updateManifest () {
  if (isUsingManifest) return

  return createPromptTask({
    message: chalk.white('Update the manifest (adapt.json)?'),
    type: 'confirm',
    default: true,
    onlyRejectOnError: true
  })
    .then(shouldUpdate => {
      if (shouldUpdate) {
        Object.keys(itinerary).forEach(function (name) {
          project.add(new Plugin(name, itinerary[name]))
        })
      }
    })
}

function summariseDryRun () {
  const toBeInstalled = plugins.filter(isToBeInstalled)
  const toBeSkipped = plugins.filter(isSkipped)
  const missing = plugins.filter(isMissing)

  summarise(toBeInstalled, toBeInstalledPrinter, 'The following plugins will be installed:')
  summarise(toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')

  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return

    console.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

function summariseInstallation () {
  // console.log('install::summariseInstallation');

  const installSucceeded = plugins.filter(isInstallSuccessful)
  const installSkipped = plugins.filter(isSkipped)
  const installErrored = plugins.filter(isInstallFailure)
  const missing = plugins.filter(isMissing)

  const allSuccess = 'All requested plugins were successfully installed. Summary of installation:'
  const someSuccess = 'The following plugins were successfully installed:'
  const noSuccess = 'None of the requested plugins could be installed'
  let successMsg

  if (!isInteractive) {
    const report = []

    if (plugins.length === 1) {
      const p = plugins[0]

      if (installSucceeded.length === 1) {
        const bowerPath = path.join(Cwd(), 'src', p._belongsTo, p.packageName, 'bower.json')
        return JsonLoader.readJSONSync(bowerPath)
      }
      if (installSkipped.length === 1) {
        throw new Error(p._error)
      }
      if (installErrored.length === 1) {
        const error = Object.assign({}, Errors.ERROR_INSTALL_ERROR)

        if (p._installError) error.message = p._installError

        throw new Error(error)
      }
      throw new Error(Errors.ERROR_NOT_FOUND)
    }

    installSucceeded.forEach(function (p) {
      const bowerPath = path.join(Cwd(), 'src', p._belongsTo, p.packageName, 'bower.json')
      report.push({
        name: p.packageName,
        status: 'fulfilled',
        pluginData: JsonLoader.readJSONSync(bowerPath)
      })
    })

    installSkipped.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'rejected',
        reason: p._error
      })
    })

    installErrored.forEach(function (p) {
      const error = Object.assign({}, Errors.ERROR_INSTALL_ERROR)

      if (p._installError) error.message = p._installError

      report.push({
        name: p.packageName,
        status: 'rejected',
        reason: error
      })
    })

    missing.forEach(function (p) {
      report.push({
        name: p.packageName,
        status: 'rejected',
        reason: Errors.ERROR_NOT_FOUND
      })
    })

    return report
  }

  if (installErrored.length === 0 && missing.length === 0) successMsg = allSuccess
  else if (installSucceeded.length === 0) successMsg = noSuccess
  else successMsg = someSuccess

  summarise(installSucceeded, installSucceededPrinter, successMsg)
  summarise(installSkipped, packageNamePrinter, 'The following plugins were skipped:')
  summarise(installErrored, installErroredPrinter, 'The following plugins could not be installed:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')

  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return

    console.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

function isToBeInstalled (p) {
  return p._versionToInstall !== undefined
}

function isInstallSuccessful (p) {
  return p._versionToInstall !== undefined && p._wasInstalled === true
}

function isInstallFailure (p) {
  return p._versionToInstall !== undefined && p._wasInstalled === false
}

function isSkipped (p) {
  return !p._isMissingAtRepo && p._versionToInstall === undefined
}

// output formatting

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

function green (str) {
  return chalk.greenBright(str)
}

function greenIfEqual (v1, v2) {
  const colourFunc = semver.satisfies(v1, v2) ? chalk.greenBright : chalk.magentaBright

  return colourFunc(v2)
}

function toBeInstalledPrinter (p) {
  const vI = p._versionToInstall; const vLC = p._latestCompatibleVersion

  if (vLC === '*') {
    console.log(highlight(p.packageName), '(no version information)')
  } else {
    console.log(highlight(p.packageName), '@' + green(vI), '(latest compatible version is ' + greenIfEqual(vI, vLC) + ')')
  }
}

function installSucceededPrinter (p) {
  const vI = p._versionToInstall; const vLC = p._latestCompatibleVersion

  if (vLC === '*') {
    console.log(highlight(p.packageName), '(no version information)')
  } else {
    console.log(highlight(p.packageName), '@' + green(vI), '(latest compatible version is ' + greenIfEqual(vI, vLC) + ')')
  }
}

function installErroredPrinter (p) {
  console.log(highlight(p.packageName), p._installError ? '(error: ' + p._installError + ')' : '(unknown error)')
}

function packageNamePrinter (p) {
  console.log(highlight(p.packageName))
}

// composite filter for when no user input is required to determine which version to install

function isVerifiedForInstallation (p) {
  return isCompatible(p) && (!isConstrained(p) || semver.satisfies(p._resolvedConstraint, p._latestCompatibleVersion))
}

// composite filters for when no compatible version exists

function isIncompatibleWithOldConstraint (p) {
  return !isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && semver.lt(semver.maxSatisfying(p._versions, p.version), p._latestVersion)
}

function isIncompatibleWithLatestConstraint (p) {
  return !isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && semver.satisfies(semver.maxSatisfying(p._versions, p.version), p._latestVersion)
}

function isIncompatibleWithBadConstraint (p) {
  return !isCompatible(p) && isConstrained(p) && isBadConstraint(p)
}

function isIncompatibleWithNoConstraint (p) {
  return !isCompatible(p) && !isConstrained(p)
}

// composite filters for when a compatible version exists

function isCompatibleWithOldCompatibleConstraint (p) {
  return isCompatible(p) && isConstraintCompatible(p) && semver.lt(p._resolvedConstraint, p._latestCompatibleVersion)
}

function isCompatibleWithBadConstraint (p) {
  return isCompatible(p) && isBadConstraint(p)
}

function isCompatibleWithOldIncompatibleConstraint (p) {
  // when the following elements of the filter are true they imply:
  //
  // isCompatible(p) - there exists a compatible version
  // isConstrained(p) - a constraint was given (i.e. not a wildcard '*')
  // isGoodConstraint(p) - the constraint resolved to a version of the plugin
  // !isConstraintCompatible(p) - the constraint did not resolve to a compatible version
  //
  // the last element determines if the constraint only specified version(s) less than the latest compatible version
  return isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && !isConstraintCompatible(p) && semver.lt(semver.maxSatisfying(p._versions, p.version), p._latestCompatibleVersion)
}

function isCompatibleWithUnmetConstraint (p) {
  // when the following elements of the filter are true they imply:
  //
  // isCompatible(p) - there exists a compatible version
  // isConstrained(p) - a constraint was given (i.e. not a wildcard '*')
  // isGoodConstraint(p) - the constraint resolved to a version of the plugin
  // !isConstraintCompatible(p) - the constraint did not resolve to a compatible version
  //
  // the last element determines if the constraint specified version(s) greater than the latest compatible version
  return isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && !isConstraintCompatible(p) && semver.gt(semver.maxSatisfying(p._versions, p.version), p._latestCompatibleVersion)
}

function isCompatibleWithNewCompatibleConstraint (p) {
  return isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && isConstraintCompatible(p) && semver.gt(semver.maxSatisfying(p._versions, p.version), p._latestCompatibleVersion)
}

// simple filters

function isConstraintCompatible (p) {
  return p._resolvedConstraint !== undefined && p._resolvedConstraint != null
}

function isCompatible (p) {
  return p._latestCompatibleVersion !== undefined && p._latestCompatibleVersion != null
}

function isConstrained (plugin) {
  return plugin.version !== '*'
}

function isGoodConstraint (plugin) {
  return plugin._isBadConstraint === false
}

function isBadConstraint (plugin) {
  return plugin._isBadConstraint === true
}

function isMissing (plugin) {
  return plugin._isMissingAtRepo === true
}

function isPresent (plugin) {
  return !isMissing(plugin)
}

function createPromptTask (params) {
  const defaultConfig = {
    name: 'question',
    onlyRejectOnError: false
  }
  const config = Object.assign({}, defaultConfig, params)
  const schema = [config]
  return inquirer.prompt(schema).then(confirmation => {
    if (!config.onlyRejectOnError && !confirmation.question) throw new Error('Aborted. Nothing has been updated.')
    return confirmation.question
  })
}

function performInstallation () {
  if (isInteractive) {
    return promiseAllProgress(plugins.filter(isToBeInstalled).map(createInstallationTask), progressUpdate).then(conclude)
  }

  return Promise.all(plugins.filter(isToBeInstalled).map(createInstallationTask))

  function progressUpdate () {
    const list = plugins.filter(isPresent).filter(isToBeInstalled)
    const settled = list.filter(function (p) { return isInstallSuccessful(p) || isInstallFailure(p) }).length
    const total = list.length
    InstallLog.logProgress(chalk.bold.cyan('<info>') + ' Installing plugins ' + Math.round(100 * settled / total) + '% complete')
  }

  function conclude () {
    InstallLog.logProgressConclusion(chalk.bold.cyan('<info>') + ' Installing plugins 100% complete')
  }
}

function createInstallationTask (plugin) {
  return getKeywords(plugin, { registry: BOWER_REGISTRY_URL, cwd: Cwd() }).then(doInstall).then(conclude)

  function doInstall (keywords) {
    const resolver = new PluginTypeResolver()
    const pluginType = resolver.resolve(keywords)

    // this lookup should probably be moved InstallTarget
    plugin._belongsTo = pluginType.belongsTo

    return performInstall(plugin, {
      directory: path.join('src', pluginType.belongsTo),
      registry: BOWER_REGISTRY_URL,
      cwd: Cwd()
    })
  }

  function conclude (result) {
    plugin._wasInstalled = result._wasInstalled === true
    if (result.error) plugin._installError = result.error.code
    // renderUpdateProgress();
  }
}

function performInstall (plugin, config) {
  return new Promise(resolve => {
    // (reliably) remove the plugin first
    rimraf(path.join(config.cwd || '.', config.directory, plugin.packageName), { disableGlob: true }, doInstall)

    function doInstall (err) {
      if (err) {
        // deferred.notify()
        resolve({ error: 'There was a problem writing to the target directory' })
      } else {
        bower.commands.install([plugin.packageName + '#' + plugin._versionToInstall], null, config)
          .on('end', function () {
            // deferred.notify()
            resolve({ _wasInstalled: true })
          })
          .on('error', function (err) {
            // deferred.notify()
            // TODO: why is this a resolve and not a reject?
            resolve({ error: 'Bower reported ' + err })
          })
      }
    }
  })
}
