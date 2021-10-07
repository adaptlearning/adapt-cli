import chalk from 'chalk'
import Project from '../Project.js'
import { installPlugins } from '../PackageManagement.js'
import { reportInvalidFrameworkDirectory } from '../../util/RendererHelpers.js'

export default async function adaptInstall ({
  dev = false,
  localDir = process.cwd(),
  logger,
  isDryRun = true,
  isCompatibleEnabled = true,
  plugins = null
} = {}) {
  const project = new Project({ localDir })
  if (!project.containsManifestFile) return reportInvalidFrameworkDirectory(logger)
  /** whether adapt.json is being used to compile the list of plugins to install */
  const isUsingManifest = !plugins.length
  /** a list of plugin name/version pairs */
  const itinerary = isUsingManifest
    ? project.pluginDependencies
    : plugins.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      itinerary[name] = version
      return itinerary
    }, {})
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)
  logger?.log(chalk.cyan('installing adapt dependencies'))
  await installPlugins(pluginNames, {
    dev,
    logger,
    localDir,
    isUsingManifest,
    isDryRun,
    isCompatibleEnabled
  })
}
