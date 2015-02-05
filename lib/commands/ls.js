var Project = require('../Project'),
    chalk = require('chalk'),
    Constants = require('../Constants');

module.exports = {
    ls: function(renderer) {
        var project = new Project(Constants.DefaultProjectManifestPath);
        project.plugins.forEach(function (p) {
            renderer.log(chalk.cyan(p.name), p.version);
        });
    }
};