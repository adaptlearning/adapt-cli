import { unregister as pluginUnregister } from '../integration/PluginManagement.js'

export default async function register (logger, ...args) {
  // strip flags
  args = args.filter(arg => !String(arg).startsWith('--'))
  const pluginName = args[0]
  return await pluginUnregister({
    logger,
    cwd: process.cwd(),
    pluginName
  })
}
