var bower = require('bower'),
    chalk = require('chalk'),
    Q = require('q');

module.exports = function update (plugin, options, config) {
    var deferred = Q.defer();

    function onSuccess(updated) {
        deferred.notify();
        deferred.resolve({updated:true});
    }

    function onFail(err) {
        deferred.notify();
        deferred.resolve({updated:false, error:err});
    }

    function onLog(obj) {
        //console.log(chalk.cyan(obj.level), obj.id, obj.message);
    }

    try {
        //console.log('UPDATE', plugin.packageName);
        bower.commands.update([plugin.packageName], options, config).on('end', onSuccess).on('error', onFail).on('log', onLog);
    } catch(err) {
        logger.log('bower update threw error');
        onFail(err);
    }

    return deferred.promise;
}