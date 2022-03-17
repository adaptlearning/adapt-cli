import { rename as pluginRename } from '../integration/PluginManagement.js'

export default async function rename (logger, ...args) {
  /** strip flags */
  args = args.filter(arg => !String(arg).startsWith('--'))
  const oldName = args[0]
  const newName = args[1]
  await pluginRename({
    logger,
    cwd: process.cwd(),
    oldName,
    newName
  })
}
