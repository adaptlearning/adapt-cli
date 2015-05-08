var bower = require('bower'),
    Q = require('q');

module.exports = {
    getKeywords: function (plugin, config) {
        var deferred = Q.defer();
        
        bower.commands.info(plugin.toString(), 'keywords', config || {})
             .on('end', function(results) {
                deferred.resolve(results);
             })
             .on('error', function(err) {
                deferred.reject(err);
             });
        return deferred.promise;
    },
    getFrameworkCompatibility: function (plugin, config) {
        var deferred = Q.defer();
        var allVersions = '*';

        bower.commands.info(plugin.toString(), 'framework', config || {})
             .on('end', function(results) {
                deferred.resolve(results || allVersions);
             })
             .on('error', function() {
                deferred.resolve(allVersions);
             });
        return deferred.promise;
    }
};