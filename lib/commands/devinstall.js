import {
  cloneFrameworkBranchTo,
  FRAMEWORK_REPOSITORY,
  FRAMEWORK_REPOSITORY_NAME
} from '../integration/AdaptFramework.js'
import path from 'path'
import Project from '../integration/Project.js'
import { installPlugins } from '../integration/PackageManagement.js'

export default async function devinstall (renderer, pluginName = FRAMEWORK_REPOSITORY) {
  const localDir = new Project().isCWDAdapt
    ? process.cwd()
    : path.resolve(FRAMEWORK_REPOSITORY_NAME)

  // We're trying to install a single plugin.
  if (pluginName !== FRAMEWORK_REPOSITORY) {
    return await installPlugins(pluginName, { clone: true, renderer, localDir })
  }

  await cloneFrameworkBranchTo({ renderer, localDir })
  await installPlugins(null, { clone: true, renderer, localDir })
}
