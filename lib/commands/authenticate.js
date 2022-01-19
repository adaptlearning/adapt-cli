import chalk from 'chalk'
import { authenticate as pluginAuthenticate } from '../integration/PluginManagement.js'

export default async function authenticate (logger, ...args) {
  // strip flags
  args = args.filter(arg => !String(arg).startsWith('--'))
  try {
    const confirmation = await pluginAuthenticate({
      logger,
      localDir: process.cwd(),
      pluginName: args[0]
    })
    const { username, type, pluginName } = confirmation
    logger?.log(chalk.green(`${username} authenticated as ${type} for ${pluginName}`))
  } catch (err) {
    logger?.log(chalk.red('Authentication failed'))
  }
}
