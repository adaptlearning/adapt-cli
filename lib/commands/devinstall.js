import { clone as adaptClone } from '../integration/AdaptFramework.js'
import { install as pluginsInstall } from '../integration/PluginManagement.js'
import { ADAPT_FRAMEWORK_NAME } from '../util/constants.js'
import path from 'path'
import Project from '../integration/Project.js'

export default async function devinstall (logger, ...args) {
  const isInAdapt = new Project().isAdaptDirectory
  // In adapt folder or download adapt into adapt_framework folder
  const localDir = isInAdapt
    ? process.cwd()
    : path.resolve(ADAPT_FRAMEWORK_NAME)
  // strip flags
  args = args.filter(arg => !String(arg).startsWith('--'))
  // always perform a clone on the adapt directory
  if (!args.length) args = [ADAPT_FRAMEWORK_NAME]
  if (!isInAdapt || args.includes(ADAPT_FRAMEWORK_NAME)) {
    await adaptClone({ logger, localDir })
    args = args.filter(arg => arg !== ADAPT_FRAMEWORK_NAME)
  }
  const plugins = args
  return await pluginsInstall({
    logger,
    localDir,
    dev: true,
    plugins
  })
}
