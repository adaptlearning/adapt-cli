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
        Download = require('download'),
        totalSize,
        receivedSize,
        previousPercent = 0;

    function progress(res, url, cb) {
        if (!res.headers['content-length']) {
            cb();
            return;
        }

        totalSize = parseInt(res.headers['content-length'], 10);
        receivedSize = 0;

        res.on('data', function(data) {
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
        .on('end', function () {
            cb();
        });
    }

    var download = new Download({extract: true, mode: '755'})
        .get(this.url)
        .dest(destination)
        .use(progress);

    download.run(function (err, files) {
        if (err) {
            return deferred.reject(err);
        }

        deferred.resolve(destination);
    });

    return deferred.promise;
};

module.exports = RepositoryDownloader;

