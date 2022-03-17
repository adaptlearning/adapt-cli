import { search as pluginsSearch } from '../integration/PluginManagement.js'

export default async function search (logger, ...args) {
  /** strip flags */
  args = args.filter(arg => !String(arg).startsWith('--'))
  const searchTerm = (args[0] || '')
  await pluginsSearch({
    logger,
    searchTerm
  })
}
