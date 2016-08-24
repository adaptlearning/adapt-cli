var chalk = require('chalk'),
    path = require('path'),
    Constants = require('../Constants'),
    PluginTypeResolver =  require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Project =  require('../Project'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers'),
    uninstallPackage = require('../promise/uninstallPackage');

module.exports = {
    uninstall: function (renderer) {

        var packageName = arguments.length >= 3 ? arguments[1] : null,
            done = arguments[arguments.length - 1];

        if(!packageName) {
            return renderer.log(chalk.red('Please specify a plugin to uninstall.'));
        }

        var project = new Project(Constants.DefaultProjectManifestPath);
        if (!project.isProjectContainsManifestFile()) {
            return RendererHelpers.reportInvalidFrameworkDirectory(renderer, done)(true);
        }

        var plugin = Plugin.parse(packageName);

        PackageMeta.getKeywords(plugin)
        .then(function (keywords) {
            var resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);

            renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Uninstalling', pluginType.typename, '...');
            return uninstallPackage(plugin, {
                directory: path.join('src', pluginType.belongsTo)
            });
        })
        .then(function (uninstalled) {
            if(uninstalled) {
                project.remove(plugin);
            }
        })
        .then(function () {
            done();
        })
        .fail(RendererHelpers.reportFailure(renderer, done));
    }

};
