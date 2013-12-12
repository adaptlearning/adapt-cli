var _ = require('lodash'),
    fs = require('fs'),
    commands = {},
    files = fs.readdirSync(__dirname);

module.exports = files.filter(excludeIndex).reduce(function (commands, filename) {
    return _.extend(commands, require('./' + filename));
}, {});

function excludeIndex (filename) {
    return !/^index.js$/.test(filename);
}
 