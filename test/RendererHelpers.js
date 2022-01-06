import chalk from 'chalk'
import inquirer from 'inquirer'

// TODO: test case helper
export function reportCompatibilityWarning (logger, plugin) {
  logger?.log(chalk.yellow('The plugin'), chalk.white(plugin), chalk.yellow('is not compatible with this version of Adapt.', 'Installing it may cause unexpected behaviour.'))
  return confirm(plugin)
}

export function reportFailure (logger, err) {
  logger?.log(chalk.red('Oh dear, something went wrong.'), err?.message || '')
}

async function confirm (plugin) {
  const schema = [
    {
      name: 'continueWithInstall',
      message: 'Install this plugin anyway?',
      type: 'confirm',
      default: false
    }
  ]
  const properties = await inquirer.prompt(schema)
  return {
    plugin: plugin,
    continueWithInstall: properties.continueWithInstall
  }
}
