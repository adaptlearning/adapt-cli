module.exports = function (dependencies) {

    var chalk = dependencies.chalk || require('chalk'),
        Project = dependencies.Project || require('../Project'),
        Constants = dependencies.Constants || require('../Constants'),
        RendererHelpers = dependencies.RendererHelpers || require('../RendererHelpers');

    return {
        ls: function(renderer) {
            var project = new Project(Constants.DefaultProjectManifestPath),
                done = arguments[arguments.length -1];

            if(project.isProjectContainsManifestFile()) {
                project.plugins.forEach(function (p) {
                    renderer.log(chalk.cyan(p.name), p.version);
                });
                done();
            } else {
                RendererHelpers.reportInvalidFrameworkDirectory(renderer, done)(true);
            }
        }
    };

};
