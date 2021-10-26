import chalk from 'chalk'
import Project from '../Project.js'
import { reportInvalidFrameworkDirectory } from '../../util/RendererHelpers.js'
import { uninstallPlugins } from '../PackageManagement.js'

export default async function adaptUninstall ({
  localDir = process.cwd(),
  logger,
  plugins = null
} = {}) {
  // TODO: Can remove this to support manifest uninstall
  // if (!plugins?.length) return logger?.log(chalk.red('Please specify a plugin to uninstall.'))
  const project = new Project({ localDir, logger })
  if (!project.containsManifestFile) return reportInvalidFrameworkDirectory(logger)
  /** whether adapt.json is being used to compile the list of plugins to install */
  const isUsingManifest = !plugins?.length
  /** a list of plugin name/version pairs */
  const itinerary = isUsingManifest
    ? project.pluginDependencies
    : plugins.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      itinerary[name] = version
      return itinerary
    }, {})
  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)
  await uninstallPlugins({
    pluginNames,
    localDir,
    logger,
    isUsingManifest
  })
}
