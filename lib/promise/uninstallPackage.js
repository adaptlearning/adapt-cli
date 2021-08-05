import bower from 'bower'
import Q from 'q'

export default function uninstall (plugin, config) {
  const deferred = Q.defer()

  bower.commands.uninstall([plugin.toString()], {}, config)
    .on('end', function (uninstalled) {
      Object.prototype.hasOwnProperty.call(uninstalled, plugin.toString()) ? deferred.resolve() : deferred.reject()
    })
    .on('error', function (err) {
      deferred.reject(err)
    })
  return deferred.promise
}
