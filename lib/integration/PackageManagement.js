import authenticate from './PackageManagement/autenticate.js'
import installPlugins from './PackageManagement/installPlugins.js'
import registerPlugin from './PackageManagement/registerPlugin.js'
import searchPlugins from './PackageManagement/searchPlugins.js'
import uninstallPlugins from './PackageManagement/uninstallPlugins.js'
import unregisterPlugin from './PackageManagement/unregisterPlugin.js'
import updatePlugins from './PackageManagement/updatePlugins.js'

// future: check adapt version for switching bower and npm style package management
export {
  authenticate,
  installPlugins,
  registerPlugin,
  searchPlugins,
  uninstallPlugins,
  unregisterPlugin,
  updatePlugins
}
