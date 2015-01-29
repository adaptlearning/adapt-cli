var Q = require('q'),
    fs = require('q-io/fs');

module.exports = function (path, match, replacement) {
    return fs.read(path)
             .then(function (content) {
                 var modifiedContent = content.replace(match, replacement);
                 return fs.write(path, modifiedContent);
             });
};