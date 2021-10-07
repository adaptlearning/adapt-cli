import { adaptInstall } from '../integration/AdaptFramework.js'

export default async function install (logger, ...args) {
  /** strip flags */
  const isDryRun = args.includes('--dry-run')
  const isCompatibleEnabled = args.includes('--compatible')
  const plugins = args.filter(arg => !String(arg).startsWith('--'))
  await adaptInstall({
    logger,
    isDryRun,
    isCompatibleEnabled,
    plugins
  })
}

// export async function api (pluginName, cwd) {
//   isInteractive = false

//   process.chdir(cwd)

//   project = new Project()

//   if (!project.containsManifestFile) {
//     throw new Error({ error: Errors.ERROR_COURSE_DIR })
//   }

//   itinerary = {}
//   plugins = []

//   init(pluginName ? [pluginName] : [])
//   createPlugins()
//   await getInitialInfo()
//   await findCompatibleVersions()
//   await checkConstraints()
//   await createInstallationManifest()
//   await performInstallation()
//   return summariseInstallation()
// }
