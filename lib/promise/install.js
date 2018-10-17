var bower = require('bower'),
    Q = require('q'),
    path = require('path'),
    rimraf = require('rimraf'),
    Plugin = require('../Plugin');

module.exports = function install (plugin, config) {
    var deferred = Q.defer();

    // (reliably) remove the plugin first
    rimraf(path.join(config.directory, plugin.packageName), {disableGlob:true}, doInstall);

    function doInstall(err) {
        if (err) {
            deferred.notify();
            deferred.resolve({error:'There was a problem writing to the target directory'});
        } else {
            bower.commands.install([plugin.packageName+'#'+plugin._versionToInstall], null, config)
            .on('end', function() {
                deferred.notify();
                deferred.resolve({_wasInstalled:true});
            })
            .on('error', function (err) {
                deferred.notify();
                deferred.resolve({error:'Bower reported '+err});
            });
        }
    }

    return deferred.promise;
}
