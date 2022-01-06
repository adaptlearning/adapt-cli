import { uninstall as pluginsUninstall } from '../integration/PluginManagement.js'

export default async function uninstall (logger, ...args) {
  const plugins = args.filter(arg => !String(arg).startsWith('--'))
  await pluginsUninstall({
    logger,
    plugins
  })
}
