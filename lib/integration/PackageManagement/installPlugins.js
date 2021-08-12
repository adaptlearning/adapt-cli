import chalk from 'chalk'
import { createPromptTask } from '../../util/createPromptTask.js'
import path from 'path'
import semver from 'semver'
import Errors from '../../util/errors.js'
import { readValidateJSONSync } from '../../util/JSONReadValidate.js'
import Plugin from '../Plugin.js'
import fs from 'fs-extra'
import { exec } from 'child_process'
import { promiseAllProgress, promiseAllSerialize } from '../../util/promises.js'
import Project from '../Project.js'
import InstallTarget from './InstallTarget.js'

export default async function installPlugins (pluginNames, {
  clone = false,
  localDir = process.cwd(),
  renderer = null,
  /** whether to summarise installation without modifying anything */
  isDryRun = process.argv.indexOf('--dry-run'),
  isUsingManifest = undefined
}) {
  if (typeof pluginNames === 'string') pluginNames = [pluginNames]

  const previousCwd = process.cwd()
  process.chdir(localDir)

  const project = new Project()
  renderer?.log(`${clone ? 'cloning' : 'installing'} plugins...`)

  /**
   * @type {[InstallTarget]}
   */
  const plugins = pluginNames
    ? pluginNames.map(nameVersion => {
      const [name, version] = nameVersion.split(/[#@]/)
      return new InstallTarget(name, version)
    })
    : project.installTargets

  if (!clone) {
    const frameworkVersion = project.getFrameworkVersion()
    await promiseAllProgress(plugins.map(plugin => plugin.getInitialInfo()), percentage => {
      renderer?.logProgress(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
    }).then(() => {
      renderer?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Finding compatible versions 100% complete`)
    })
    await promiseAllProgress(plugins.map(plugin => plugin.findCompatibleVersion(frameworkVersion)), percentage => {
      renderer?.logProgress(`${chalk.bold.cyan('<info>')} Finding compatible versions ${percentage}% complete`)
    }).then(() => {
      renderer?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Finding compatible versions 100% complete`)
    })
    await promiseAllProgress(plugins.map(plugin => plugin.checkConstraints(frameworkVersion)), percentage => {
      renderer?.logProgress(`${chalk.bold.cyan('<info>')} Checking constraints ${percentage}% complete`)
    }).then(() => {
      renderer?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Checking constraints 100% complete`)
    })
    await promiseAllProgress(plugins.map(plugin => plugin.markInstallable()), percentage => {
      renderer?.logProgress(`${chalk.bold.cyan('<info>')} Marking installable ${percentage}% complete`)
    }).then(() => {
      renderer?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Marking installable 100% complete`)
    })
  }

  if (clone) {
    await cloneInstall(renderer, plugins)
  } else {
    await bowerInstall(renderer, project, plugins, isDryRun, isUsingManifest)
  }

  process.chdir(previousCwd)
}

/**
 *
 * @param {object} renderer
 * @param {[InstallTarget]} plugins
 * @returns
 */
async function cloneInstall (renderer, plugins) {
  return Promise.all(plugins.map(async (plugin) => {
    const pluginType = await plugin.getType()
    renderer?.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...')
    const repoDetails = await plugin.getRepositoryUrl()
    if (!repoDetails) {
      throw new Error('Error: Plugin repository url could not be found.')
    }
    await fs.ensureDir(path.resolve(process.cwd(), 'src', pluginType.belongsTo))
    const pluginPath = path.resolve(process.cwd(), 'src', pluginType.belongsTo, plugin.name)
    const url = repoDetails.url.replace(/^git:\/\//, 'https://')
    const exitCode = await new Promise(resolve => exec(`git clone ${url} "${pluginPath}"`, resolve))
    if (!exitCode) throw new Error('The plugin was found but failed to download and install.')
    if (plugin.version !== '*') {
      try {
        await new Promise(resolve => exec(`git checkout -C "${pluginPath}" ${plugin.version}`, resolve))
        renderer?.log(chalk.green(plugin.packageName), `is on branch "${plugin.version}".`)
      } catch (err) {
        renderer?.log(chalk.yellow(plugin.packageName), `could not checkout branch "${plugin.version}".`)
      }
    }
    renderer?.log(chalk.green(plugin.packageName), 'has been installed successfully.')
  }))
}

/**
 *
 * @param {object} renderer
 * @param {Project} project
 * @param {[InstallTarget]} plugins
 * @param {boolean} isDryRun
 * @param {boolean} isUsingManifest
 * @returns
 */
async function bowerInstall (renderer, project, plugins, isDryRun, isUsingManifest) {
  /**
   * @param {[InstallTarget]} plugins
   * @param {*} isInteractive
   * @returns
   */
  async function interactiveConflictResolution (plugins, isInteractive) {
    async function getPromptIncompatibleGeneric (p) {
      const result = await createPromptTask({ message: chalk.reset(p.packageName), choices: [{ name: 'latest version', value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
      const installLatest = result === 'l'
      if (installLatest) p.markLatestForInstallation()
    }
    async function getPromptCompatibleWithOldIncompatibleConstraint (p) {
      const result = await createPromptTask({ message: chalk.white(p.packageName), choices: [{ name: `requested version [${semver.maxSatisfying(p._versions, p.version)}]`, value: 'r' }, { name: `latest compatible version [${p._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'
      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    }
    async function getPromptCompatibleWithOldCompatibleConstraint (p) {
      const result = await createPromptTask({ message: chalk.white(p.packageName), choices: [{ name: `requested version [${p._resolvedConstraint}]`, value: 'r' }, { name: `latest compatible version [${p._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'
      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    }
    async function getPromptCompatibleWithNewCompatibleConstraint (p) {
      const result = await createPromptTask({ message: chalk.white(p.packageName), choices: [{ name: `requested version [${p._resolvedConstraint}]`, value: 'r' }, { name: `latest compatible version [${p._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'
      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    }
    async function getPromptCompatibleWithBadConstraint (p) {
      const result = await createPromptTask({ message: chalk.white(p.packageName), type: 'list', choices: [{ name: `compatible version [${p._latestCompatibleVersion}]`, value: 'c' }, { name: 'skip', value: 's' }], default: 's', onlyRejectOnError: true })
      const installLatestCompatible = result === 'c'
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    }
    async function getPromptCompatibleWithUnmetConstraint (p) {
      const result = await createPromptTask({ message: chalk.white(p.packageName), choices: [{ name: `requested version [${semver.maxSatisfying(p._versions, p.version)}]`, value: 'r' }, { name: `latest compatible version [${p._latestCompatibleVersion}]`, value: 'l' }, { name: 'skip', value: 's' }], type: 'list', default: 's', onlyRejectOnError: true })
      const installRequested = result === 'r'
      const installLatestCompatible = result === 'l'
      if (installRequested) p.markRequestedForInstallation()
      if (installLatestCompatible) p.markLatestCompatibleForInstallation()
    }
    function add (list, header, prompt) {
      if (!list.length) return
      return {
        header: chalk.cyan('<info> ') + header,
        list: list,
        prompt: prompt
      }
    }
    const allQuestions = [
      add(plugins.filter(p => p.isIncompatibleWithOldConstraint), 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
      add(plugins.filter(p => p.isIncompatibleWithLatestConstraint), 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
      add(plugins.filter(p => p.isIncompatibleWithBadConstraint), 'An invalid constraint was given, but there is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
      add(plugins.filter(p => p.isIncompatibleWithNoConstraint), 'There is no compatible version of the following plugins:', getPromptIncompatibleGeneric),
      add(plugins.filter(p => p.isCompatibleWithOldIncompatibleConstraint), 'An older incompatible version has been requested for the following plugins:', getPromptCompatibleWithOldIncompatibleConstraint),
      add(plugins.filter(p => p.isCompatibleWithOldCompatibleConstraint), 'A compatible but older version has been requested for the following plugins:', getPromptCompatibleWithOldCompatibleConstraint),
      add(plugins.filter(p => p.isCompatibleWithNewCompatibleConstraint), 'A compatible but newer version has been requested for the following plugins:', getPromptCompatibleWithNewCompatibleConstraint),
      add(plugins.filter(p => p.isCompatibleWithBadConstraint), 'An invalid constraint was given but a compatible version exists for the following plugins:', getPromptCompatibleWithBadConstraint),
      add(plugins.filter(p => p.isCompatibleWithUnmetConstraint), 'The requested version is incompatible but a compatible version exists for the following plugins:', getPromptCompatibleWithUnmetConstraint)
    ].filter(Boolean)
    if (allQuestions.length === 0) return
    for (const question of allQuestions) {
      console.log(question.header)
      await promiseAllSerialize(question.list, question.prompt)
    }
  }

  await interactiveConflictResolution(plugins)

  if (isDryRun) {
    summariseDryRun(plugins)
    return
  }

  await promiseAllProgress(plugins.filter(p => p.isToBeInstalled).map(p => p.install()), percentage => {
    renderer?.logProgress(`${chalk.bold.cyan('<info>')} Installing plugins ${percentage}% complete`)
  }).then(() => {
    renderer?.logProgressConclusion(`${chalk.bold.cyan('<info>')} Installing plugins 100% complete`)
  })

  if (isUsingManifest) await updateManifest(project)
  return summariseInstallation(plugins, true)
}

function updateManifest (project, itinerary) {
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

/**
 *
 * @param {[InstallTarget]} plugins
 */
function summariseDryRun (plugins) {
  const toBeInstalled = plugins.filter(p => p.isToBeInstalled)
  const toBeSkipped = plugins.filter(p => p.isSkipped)
  const missing = plugins.filter(p => p.isMissing)

  summarise(toBeInstalled, toBeInstalledPrinter, 'The following plugins will be installed:')
  summarise(toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:')
  summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:')

  function summarise (list, iterator, header) {
    if (!list || !iterator || list.length === 0) return

    console.log(chalk.cyanBright(header))
    list.forEach(iterator)
  }
}

function summariseInstallation (plugins, isInteractive) {
  // console.log('install::summariseInstallation');

  const installSucceeded = plugins.filter(p => p.isInstallSuccessful)
  const installSkipped = plugins.filter(p => p.isSkipped)
  const installErrored = plugins.filter(p => p.isInstallFailure)
  const missing = plugins.filter(p => p.isMissing)

  const allSuccess = 'All requested plugins were successfully installed. Summary of installation:'
  const someSuccess = 'The following plugins were successfully installed:'
  const noSuccess = 'None of the requested plugins could be installed'
  let successMsg

  if (!isInteractive) {
    const report = []

    if (plugins.length === 1) {
      const p = plugins[0]

      if (installSucceeded.length === 1) {
        const bowerPath = path.join(process.cwd(), 'src', p._belongsTo, p.packageName, 'bower.json')
        return readValidateJSONSync(bowerPath)
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
      const bowerPath = path.join(process.cwd(), 'src', p._belongsTo, p.packageName, 'bower.json')
      report.push({
        name: p.packageName,
        status: 'fulfilled',
        pluginData: readValidateJSONSync(bowerPath)
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
