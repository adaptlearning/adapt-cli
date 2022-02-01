import { clone as adaptClone } from '../integration/AdaptFramework.js'
import { install as pluginsInstall } from '../integration/PluginManagement.js'
import { ADAPT_FRAMEWORK } from '../util/constants.js'
import path from 'path'
import Project from '../integration/Project.js'
import gh from 'parse-github-url'

export default async function devinstall (logger, ...args) {
  const NAME = gh(ADAPT_FRAMEWORK).repo
  const isInAdapt = new Project().isAdaptDirectory
  // In adapt folder or download adapt into adapt_framework folder
  const cwd = isInAdapt
    ? process.cwd()
    : path.resolve(NAME)
  // strip flags
  const isClean = args.includes('--clean')
  const isDryRun = args.includes('--dry-run') || args.includes('--check')
  const isCompatibleEnabled = args.includes('--compatible')
  args = args.filter(arg => !String(arg).startsWith('--'))
  // always perform a clone on the adapt directory
  if (!args.length) args = [NAME]
  if (!isInAdapt || args.includes(NAME)) {
    await adaptClone({ logger, cwd })
    args = args.filter(arg => arg !== NAME)
  }
  const plugins = args
  return await pluginsInstall({
    logger,
    cwd,
    isClean,
    isDryRun,
    isCompatibleEnabled,
    dev: true,
    plugins
  })
}
