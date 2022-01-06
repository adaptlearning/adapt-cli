import { register as pluginRegister } from '../integration/PluginManagement.js'

export default async function register (logger, ...args) {
  // strip flags
  args = args.filter(arg => !String(arg).startsWith('--'))
  return await pluginRegister({
    logger,
    localDir: process.cwd(),
    args
  })
}
