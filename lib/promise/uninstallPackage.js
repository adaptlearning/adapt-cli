var bower = require('bower'),
    Q = require('q');

module.exports = function uninstall (plugin, config) {
    var deferred = Q.defer();

    bower.commands.uninstall([plugin.toString()], {}, config)
    .on('end', function(uninstalled) {
        deferred.resolve(!!uninstalled);
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
};