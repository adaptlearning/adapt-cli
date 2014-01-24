var Constants = require('./Constants'),
    urljoin = require('url-join'),
    path = require('path'),
    Q = require('q');

var RepositoryDownloader = function(options) {
    if (!options.branch && !options.repository)
        throw new Error('Repository details are required.');
    this.options = options;

    Object.defineProperty(this, 'url', {
        get: function() {
            return urljoin(this.options.repository, 'archive', this.options.branch + '.zip');
        }
    });
};

RepositoryDownloader.prototype.fetch = function(destination) {
    var deferred = Q.defer(),
        download = require('download');

    download(this.url, destination, {
        extract: true
    })
    .on('data', function() {
        deferred.notify();
    })
    .on('error', function(err) {
        deferred.reject(err);
    })
    .on('close', function() {
        deferred.resolve(destination);
    });

    return deferred.promise;    
};

module.exports = RepositoryDownloader;

