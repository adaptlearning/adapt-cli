var bower = require('bower'),
    Q = require('q'),
    Plugin = require('../Plugin'),
    uninstallPackage = require('./uninstallPackage');

module.exports = function install (plugin, options, config) {
    var deferred = Q.defer();
    console.log('INSTALL', plugin.toString());
    bower.commands.install([plugin.toString()], options, config)
    .on('end', function(installed) {
        deferred.resolve({_wasIntalled:true});
    })
    .on('error', function (err) {
        if(err.code !== 'ECONFLICT') {
            deferred.resolve({_wasIntalled:false, error:err});
        }
        uninstallPackage(Plugin.parse(plugin.packageName), config)
        .then(function () {
            console.log('REINSTALL');
            return install(plugin, options, config);
        })
        .then(function (installed) {
            deferred.resolve({_wasIntalled:true});
        })
        .fail(function (err) {
            deferred.resolve({_wasIntalled:false, error:err});
        });
    });
    return deferred.promise;
}
