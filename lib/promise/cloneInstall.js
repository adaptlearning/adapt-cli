var Q = require('q'),
    PackageMeta = require('../PackageMeta'),
    path = require('path'),
    Plugin = require('../Plugin'),
    mkdirp = require('mkdirp'),
    nodegit = require('nodegit');

module.exports = function cloneInstall(plugin, options) {
    var deferred = Q.defer();

    PackageMeta.getRepositoryUrl(plugin)
        .then(function(repoDetails) {
            mkdirp(path.resolve(options.localPath, options.directory), function (err) {
                if (err) {
                    return deferred.reject(err);
                }
                var pluginPath = path.resolve(options.localPath, options.directory, plugin.name);

                nodegit.Clone.clone(repoDetails.url, pluginPath, null);
            });
        })
        .then(function(repo){
            deferred.resolve(plugin)
        })
        .fail(function(err) {
            deferred.reject(err);
        })
        .done();
    return deferred.promise;
};