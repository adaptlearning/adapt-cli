import bower from 'bower'
import Q from 'q'

export default function update (plugin, options, config) {
  const deferred = Q.defer()

  function onSuccess () {
    // console.log('onSuccess');
    deferred.notify()
    deferred.resolve({ updated: true })
  }

  function onFail (err) {
    console.log('onFail', err)
    deferred.notify()
    deferred.resolve({ updated: false, error: err })
  }

  function onLog (obj) {
    // console.log(chalk.cyan(obj.level), obj.id, obj.message);
  }

  try {
    // console.log('UPDATE', plugin.packageName, config);
    bower.commands.update([plugin.packageName], options, config).on('end', onSuccess).on('error', onFail).on('log', onLog)
  } catch (err) {
    console.log('bower update threw error')
    onFail(err)
  }

  return deferred.promise
}
