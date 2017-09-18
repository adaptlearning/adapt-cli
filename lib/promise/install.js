var bower = require('bower'),
    Q = require('q'),
    Plugin = require('../Plugin'),
    uninstallPackage = require('./uninstallPackage'),
    Constants = require('../Constants');

module.exports = function install (plugin, config, attempts) {
    var deferred = Q.defer();

    attempts = attempts || 0;
    attempts++;

    bower.commands.install([plugin.toString()], { save: false }, config)
    .on('end', function(installed) {
        deferred.resolve(installed);
    })
    .on('error', function (err) {
        console.log('an',err.code,'occurred');
        /*if(err.code !== 'ECONFLICT') {
            console.log('i will reject the ECONFLICT');
            deferred.reject(err);
        }*/
        console.log('i will uninstall',plugin.toString());
        uninstallPackage(plugin, config)
        .then(function () {
            if (attempts < Constants.MaxAttempts) {
                console.log('ok i uninstalled that so i will try again');
                return install(plugin, config, attempts);
            } else {
                console.log('attempts now='+attempts+' so giving up');
                return Q.reject(err);
            }
        })
        .then(function (installed) {
            deferred.resolve(installed);
        })
        .fail(function (err) {
            deferred.reject(err);
        });
    })
    .on('log', function(e) {
        switch ([e.level]) {
            //case 'info': return console.info(e.message);
            case 'warn': return console.warn(e.message);
            case 'error': return console.error(e.message);
            case 'conflict': return console.error(e.level, e.message);
            //default: return console.log(e.level, e.message);
        }
    });
    return deferred.promise;
}
