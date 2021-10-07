import { adaptUninstall } from '../integration/AdaptFramework.js'

export default async function uninstall (logger, ...args) {
  const plugins = args.filter(arg => !String(arg).startsWith('--'))
  await adaptUninstall({ logger, plugins })
}

// export function api (pluginName, cwd) {
//   process.chdir(cwd)

//   const project = new Project()

//   if (!project.containsManifestFile) {
//     return Q.reject(Errors.ERROR_COURSE_DIR)
//   }

//   const plugin = Plugin.parse(pluginName)
//   const deferred = Q.defer()

//   getPluginKeywords(plugin)
//     .then(function (keywords) {
//       const resolver = new PluginTypeResolver()
//       const pluginType = resolver.resolve(keywords)

//       return uninstallPackage(plugin, {
//         directory: path.join('src', pluginType.belongsTo),
//         cwd: process.cwd()
//       })
//     })
//     .then(function () {
//       project.remove(plugin)
//     })
//     .then(function () {
//       deferred.resolve(pluginName)
//     })
//     .fail(function () {
//     // will fail if plugin has not been installed by Bower (i.e. the .bower.json manifest is missing)
//     // so just try and remove the directory (this is basically what Bower does anyway)

//       let removePath;

//       ['components', 'extensions', 'menu', 'theme'].forEach(function (pluginType) {
//         const pluginPath = path.join(process.cwd(), 'src', pluginType, plugin.packageName)

//         if (fs.existsSync(pluginPath)) {
//           removePath = pluginPath
//         }
//       })

//       if (removePath) {
//         rimraf(removePath, function () {
//           if (fs.existsSync(removePath)) {
//             deferred.reject(Errors.ERROR_UNINSTALL)
//           } else {
//             project.remove(plugin)
//             deferred.resolve(pluginName)
//           }
//         })
//       } else {
//         deferred.reject(Errors.ERROR_NOT_FOUND)
//       }
//     })

//   return deferred.promise
// }
