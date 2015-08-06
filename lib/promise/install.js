var bower = require('bower'),
    Q = require('q'),
    Plugin = require('../Plugin'),
    uninstallPackage = require('./uninstallPackage');

module.exports = function install (plugin, config) {
    var deferred = Q.defer();

    bower.commands.install([plugin.toString()], { save: false }, config)
    .on('end', function(installed) {
        deferred.resolve(installed);
    })
    .on('error', function (err) {
        if(err.code !== 'ECONFLICT') {
            deferred.reject(err);
        }
        uninstallPackage(Plugin.parse(plugin.packageName), config)
        .then(function () {
            return install(plugin, config);
        })
        .then(function (installed) {
            deferred.resolve(installed);
        })
        .fail(function (err) {
            deferred.reject(err);
        });
    });
    return deferred.promise;
}
