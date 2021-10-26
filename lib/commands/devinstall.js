import {
  cloneFrameworkBranchTo,
  adaptInstall
} from '../integration/AdaptFramework.js'
import { FRAMEWORK_REPOSITORY_NAME } from '../integration/AdaptFramework/constants.js'
import path from 'path'
import Project from '../integration/Project.js'

export default async function devinstall (logger, ...args) {
  const isInAdapt = new Project().isAdaptDirectory
  // In adapt folder or download adapt into adapt_framework folder
  const localDir = isInAdapt
    ? process.cwd()
    : path.resolve(FRAMEWORK_REPOSITORY_NAME)
  // strip flags
  args = args.filter(arg => !String(arg).startsWith('--'))
  // always perform a clone on the adapt directory
  if (!args.length) args = [FRAMEWORK_REPOSITORY_NAME]
  if (!isInAdapt || args.includes(FRAMEWORK_REPOSITORY_NAME)) {
    await cloneFrameworkBranchTo({ logger, localDir })
    args = args.filter(arg => arg !== FRAMEWORK_REPOSITORY_NAME)
  }
  const plugins = args
  return await adaptInstall({ logger, localDir, dev: true, plugins })
}
