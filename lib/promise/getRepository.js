var RepositoryDownloader = require('../RepositoryDownloader'),
    uuid = require('uuid'),
    fs = require('q-io/fs'),
    path = require('path'),
    Constants = require('../Constants');

module.exports = function (properties) {
    var downloader = new RepositoryDownloader({
            repository: properties.repository || Constants.FrameworkRepository,
            branch : properties.branch
        }),
        tmp = properties.tmp = path.join(Constants.HomeDirectory, '.adapt', 'tmp', uuid.v1()),
        downloadedSource = path.join(tmp, (properties.repositoryName || Constants.FrameworkRepositoryName) + '-' + properties.branch);

    return downloader.fetch(tmp)
                     .then(function () {
                         return fs.copyTree(downloadedSource, properties.localDir)
                                  .then(function () {
                                     return properties;
                                  });
                     });
};