import Q from 'q'
import { getRepositoryUrl } from '../PackageMeta.js'
import path from 'path'
import mkdirp from 'mkdirp'
import { exec } from 'child_process'

export default function cloneInstall (plugin, options) {
  const deferred = Q.defer()

  getRepositoryUrl(plugin, options)
    .then(function (repoDetails) {
      if (!repoDetails) {
        console.log(plugin)
        throw new Error('Error: Plugin repository url could not be found.')
      }
      mkdirp(path.resolve(options.localPath, options.directory), function (err) {
        if (err) {
          return deferred.reject(err)
        }
        const pluginPath = path.resolve(options.localPath, options.directory, plugin.name)

        const url = repoDetails.url.replace(/^git:\/\//, 'https://')
        exec(`git clone ${url} "${pluginPath}"`)
      })
    })
    .then(function (repo) {
      deferred.resolve(plugin)
    })
    .fail(function (err) {
      deferred.reject(err)
    })
    .done()
  return deferred.promise
}
