var _ = require('lodash'),
    fs = require('fs'),
    commands = {},
    files = fs.readdirSync(__dirname);

module.exports = files.filter(excludeIndex).reduce(function (commands, filename) {
    var useDefaultDependencies = {},
        command = require('./' + filename);

    if(typeof command === 'function') command = command(useDefaultDependencies);
    return _.extend(commands, command);
}, {});

function excludeIndex (filename) {
    return !/^index.js$/.test(filename);
}