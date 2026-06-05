import chalk from 'chalk'
import semver from 'semver'
import { ADAPT_ALLOW_PRERELEASE } from '../../util/constants.js'
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

function highlight (pluginname) {
  return ['adapt-contrib', 'adapt-'].reduce((output, prefix) => {
    if (output || !pluginname.startsWith(prefix)) return output
    return chalk.reset(prefix) + chalk.yellowBright(pluginname.substring(prefix.length))
  }, null) || pluginname
}

function greenIfEqual (v1, v2) {
  if (v1 === '*') return chalk.greenBright(v2)
  return semver.satisfies(v1, v2, semverOptions)
    ? chalk.greenBright(v2)
    : chalk.magentaBright(v2)
}

export function versionPrinter (plugin, logger) {
  const {
    versionToApply,
    latestCompatibleSourceVersion
  } = plugin
  const sourceLabel = plugin.isLocalSource ? ' (local)' : plugin.isGitSource ? ' (git)' : ` (latest compatible version is ${greenIfEqual(versionToApply, latestCompatibleSourceVersion)})`
  logger?.log(highlight(plugin.packageName), latestCompatibleSourceVersion === null
    ? '(no version information)'
    : `${chalk.greenBright(versionToApply)}${sourceLabel}`
  )
}

export function existingVersionPrinter (plugin, logger) {
  const {
    preUpdateProjectVersion,
    projectVersion,
    latestCompatibleSourceVersion
  } = plugin
  const fromTo = preUpdateProjectVersion !== null
    ? `from ${chalk.greenBright(preUpdateProjectVersion)} to ${chalk.greenBright(projectVersion)}`
    : `${chalk.greenBright(projectVersion)}`
  const sourceLabel = plugin.isLocalSource ? ' (local)' : plugin.isGitSource ? ' (git)' : ` (latest compatible version is ${greenIfEqual(projectVersion, latestCompatibleSourceVersion)})`
  logger?.log(highlight(plugin.packageName), latestCompatibleSourceVersion === null
    ? fromTo
    : `${fromTo}${sourceLabel}`
  )
}

export function errorPrinter (plugin, logger) {
  logger?.log(highlight(plugin.packageName), plugin.installError ? '(error: ' + plugin.installError + ')' : '(unknown error)')
}

export function packageNamePrinter (plugin, logger) {
  logger?.log(highlight(plugin.packageName))
}
