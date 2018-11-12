var chalk = require('chalk'),
    Constants = require('../Constants'),
    Project = require('../Project'),
    path = require('path'),
    JsonLoader = require('../JsonLoader');

module.exports = {
    version: function(renderer) {
        var versionPath = path.join(__dirname, '../../package.json');
        var version = JsonLoader.readJSONSync(versionPath).version;
        var project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
        renderer.log('CLI: ' + version);
        renderer.log('Framework: ' + project.getFrameworkVersion());
    }
};
