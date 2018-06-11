var chalk = require('chalk'),
    Constants = require('../Constants'),
    Project = require('../Project'),
    fs = require('fs'),
    path = require('path');

module.exports = {
    version: function(renderer) {
        var versionPath = path.join(__dirname, '../../VERSION');
        var version = fs.readFileSync(versionPath, { encoding: 'utf8'});
        var project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
        renderer.log('CLI: ' + version);
        renderer.log('Framework: ' + project.getFrameworkVersion());
    }
};
