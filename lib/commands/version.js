var chalk = require('chalk'),
    Constants = require('../Constants'),
    fs = require('fs'),
    path = require('path');

module.exports = {
    version: function(renderer) {
        var versionPath = path.join(__dirname, '../../VERSION');
        var version = fs.readFileSync(versionPath, { encoding: 'utf8'});
        renderer.log(version);
    }
};