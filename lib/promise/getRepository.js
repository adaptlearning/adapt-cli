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
        tmp = properties.tmp = path.join(Constants.HomeDirectory, '.adapt', 'tmp', uuid.v1());

    return downloader.fetch(tmp)
                     .then(function (fileName) {
                         return fs.copyTree(getDownloadedSourcePath(properties, fileName), properties.localDir)
                                  .then(function () {
                                     return properties;
                                  });
                     });
};

function getDownloadedSourcePath(properties, fileName) {
    var fName = fileName ? fs.base(fileName, fs.extension(fileName)) : ((properties.repositoryName || Constants.FrameworkRepositoryName) + '-' + properties.branch);
    return path.join(properties.tmp, fName);
}
