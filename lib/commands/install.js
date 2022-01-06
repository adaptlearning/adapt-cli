import { install as pluginsInstall } from '../integration/PluginManagement.js'

export default async function install (logger, ...args) {
  /** strip flags */
  const isDryRun = args.includes('--dry-run') || args.includes('--check')
  const isCompatibleEnabled = args.includes('--compatible')
  const plugins = args.filter(arg => !String(arg).startsWith('--'))
  await pluginsInstall({
    logger,
    isDryRun,
    isCompatibleEnabled,
    plugins
  })
}
