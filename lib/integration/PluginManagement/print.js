import chalk from 'chalk'
import semver from 'semver'
import { ADAPT_ALLOW_PRERELEASE } from '../../util/constants.js'
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

export function highlight (pluginname) {
  return ['adapt-contrib', 'adapt-'].reduce((output, prefix) => {
    if (output || !pluginname.startsWith(prefix)) return output
    return chalk.reset(prefix) + chalk.yellowBright(pluginname.substring(prefix.length))
  }, null) || pluginname
}

export function greenIfEqual (v1, v2) {
  if (v1 === '*') return chalk.greenBright(v2)
  return semver.satisfies(v1, v2, semverOptions)
    ? chalk.greenBright(v2)
    : chalk.magentaBright(v2)
}

export function green (string) {
  return chalk.greenBright(string)
}

export function versionPrinter (plugin) {
  const {
    versionToApply,
    latestCompatibleSourceVersion
  } = plugin
  console.log(highlight(plugin.packageName), latestCompatibleSourceVersion === null
    ? '(no version information)'
    : `${green(versionToApply)}${plugin.isLocalSource ? ' (local)' : ` (latest compatible version is ${greenIfEqual(versionToApply, latestCompatibleSourceVersion)})`}`
  )
}

export function existingVersionPrinter (plugin) {
  const {
    preUpdateProjectVersion,
    projectVersion,
    latestCompatibleSourceVersion
  } = plugin
  const fromTo = preUpdateProjectVersion !== null
    ? `from ${green(preUpdateProjectVersion)} to ${green(projectVersion)}`
    : `${green(projectVersion)}`
  console.log(highlight(plugin.packageName), latestCompatibleSourceVersion === null
    ? fromTo
    : `${fromTo}${plugin.isLocalSource ? ' (local)' : ` (latest compatible version is ${greenIfEqual(projectVersion, latestCompatibleSourceVersion)})`}`
  )
}

export function errorPrinter (plugin) {
  console.log(highlight(plugin.packageName), plugin.installError ? '(error: ' + plugin.installError + ')' : '(unknown error)')
}

export function packageNamePrinter (plugin) {
  console.log(highlight(plugin.packageName))
}
