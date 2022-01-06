import chalk from 'chalk'
import semver from 'semver'

export function highlight (str) {
  return ['adapt-contrib', 'adapt-'].reduce((output, prefix) => {
    if (output || !str.startsWith(prefix)) return output
    return chalk.reset(prefix) + chalk.yellowBright(str.substring(prefix.length))
  }, null) || str
}

export function greenIfEqual (v1, v2) {
  return semver.satisfies(v1, v2)
    ? chalk.greenBright(v2)
    : chalk.magentaBright(v2)
}

export function green (str) {
  return chalk.greenBright(str)
}

export function versionPrinter (plugin) {
  const vI = plugin._versionToInstall
  const vLC = plugin._latestCompatibleVersion
  console.log(highlight(plugin.packageName), vLC === '*'
    ? '(no version information)'
    : '@' + green(vI), '(latest compatible version is ' + greenIfEqual(vI, vLC) + ')'
  )
}

export function installErroredPrinter (plugin) {
  console.log(highlight(plugin.packageName), plugin._installError ? '(error: ' + plugin._installError + ')' : '(unknown error)')
}

export function packageNamePrinter (plugin) {
  console.log(highlight(plugin.packageName))
}
