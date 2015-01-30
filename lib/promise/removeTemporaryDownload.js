var fs = require('q-io/fs');

module.exports = function (properties) {
    return fs.removeTree(properties.tmp)
             .then(function () {
                return properties;
             });
};