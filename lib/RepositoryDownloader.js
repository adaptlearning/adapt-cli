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
        download = require('download'),
        totalSize,
        receivedSize,
        previousPercent = 0,
        fileName = '';

    download(this.url, destination, {
        extract: true
    })
    .on('response', function (response) {
        totalSize = Number(response.headers['content-length']);
        fileName = getFileName(response.headers['content-disposition']);
        receivedSize = 0;
    })
    .on('data', function(data) {
        receivedSize += data.length;

        var state = {
            receivedSize: receivedSize,
            percent: totalSize ? Math.round(receivedSize / totalSize * 100) : null
        };
        
        if(state.percent > previousPercent) {
            previousPercent = state.percent;
            deferred.notify(state, data);
        }
    })
    .on('error', function(err) {
        deferred.reject(err);
    })
    .then(function() {
        deferred.resolve(fileName);
    });

    return deferred.promise;
};

function getFileName(disposition) {
    var fileName = "";
    if (disposition && disposition.indexOf('attachment') !== -1) {
        var regex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        var matches = regex.exec(disposition);
        if (matches != null && matches[1]) {
            fileName = matches[1].replace(/['"]/g, '');
        }
    }
    return fileName;
}

module.exports = RepositoryDownloader;

