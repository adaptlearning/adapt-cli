import { installPlugins } from '../integration/PackageManagement.js'
import Project from '../integration/Project.js'
import { reportInvalidFrameworkDirectory } from '../util/RendererHelpers.js'
import readline from 'readline'

const InstallLog = {
  isLoggingProgress: false,
  lastProgressStr: '',
  logProgress (str) {
    this.lastProgressStr = str
    this.isLoggingProgress = true
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(str)
  },
  logProgressConclusion (str) {
    this.lastProgressStr = str
    this.isLoggingProgress = false
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(str)
    process.stdout.write('\n')
  },
  log () {
    if (this.isLoggingProgress) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      console.log.apply(console, arguments)
      this.logProgress(this.lastProgressStr)
    } else {
      console.log.apply(console, arguments)
    }
  }
}

export default async function install (renderer, ...args) {
  const project = new Project()
  if (!project.isProjectContainsManifestFile()) return reportInvalidFrameworkDirectory(renderer)

  /** strip flags */
  args = args.filter(arg => !String(arg).startsWith('--'))

  /** whether adapt.json is being used to compile the list of plugins to install */
  const isUsingManifest = !args.length

  /** a list of plugin name/version pairs */
  const itinerary = isUsingManifest
    ? new Project().pluginDependencies
    : args.reduce((itinerary, arg) => {
      const [name, version = '*'] = arg.split(/[#@]/)
      itinerary[name] = version
      return itinerary
    }, {})

  const pluginNames = Object.entries(itinerary).map(([name, version]) => `${name}#${version}`)
  await installPlugins(pluginNames, {
    renderer: InstallLog,
    isUsingManifest
  })
}

// export async function api (pluginName, cwd) {
//   isInteractive = false

//   process.chdir(cwd)

//   project = new Project()

//   if (!project.isProjectContainsManifestFile()) {
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
