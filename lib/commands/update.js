import { update as pluginsUpdate } from '../integration/PluginManagement.js'

export default async function update (logger, ...args) {
  /** strip flags */
  const isDryRun = args.includes('--dry-run') || args.includes('--check')
  const plugins = args.filter(arg => !String(arg).startsWith('--'))
  await pluginsUpdate({
    logger,
    plugins,
    isDryRun
  })
}
