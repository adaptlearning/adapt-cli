var promise = require('../promise/util');

module.exports = function (dependencies) {

    var chalk = dependencies.chalk || require('chalk'),
        path = dependencies.path || require('path'),
        Q = dependencies.Q || require('q'),
        Constants = dependencies.Constants || require('../Constants'),
        PluginTypeResolver = dependencies.PluginTypeResolver || require('../PluginTypeResolver'),
        PackageMeta = dependencies.PackageMeta || require('../PackageMeta'),
        Project = dependencies.Project || require('../Project'),
        Plugin = dependencies.Plugin || require('../Plugin'),
        RendererHelpers = dependencies.RendererHelpers || require('../RendererHelpers'),
        VersionChecker = dependencies.VersionChecker || require('../VersionChecker'),
        install = dependencies.install || require('../promise/install');

    var versionChecker = new VersionChecker(RendererHelpers, Q);

    return {
        install: function (renderer) {
            var packageName = arguments.length >= 3 ? arguments[1] : null,
                done = arguments[arguments.length-1] || function () {};

            var project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath),
                plugins = packageName ? [Plugin.parse(packageName)] : project.plugins;

            var versionChecks = plugins.map(function(plugin){
                return PackageMeta.getFrameworkCompatibility(plugin)
                                  .then(function (versionRange) {
                                        return {
                                            plugin: plugin,
                                            isCompatible: versionChecker.assertVersionCompatibility(project.getFrameworkVersion(), versionRange)
                                        };
                                  });
            });

            Q.all(versionChecks)
             .then(function (checkedPlugins) {
                    console.log(checkedPlugins)
                return promise.serialise(checkedPlugins, function (result) {
                    if(!result.isCompatible) {
                        return RendererHelpers.reportCompatibilityWarning(renderer, result.plugin);
                    } else {
                        result.continueWithInstall = true;
                        return Q(result);
                    }
                });
             })
             .then(function (confirmedPlugins) {
                var installations = confirmedPlugins.filter(function (result) {
                        return result.continueWithInstall;
                    })
                    .map(function (result) {
                        var plugin = result.plugin;

                        project.add(plugin);

                        return PackageMeta.getKeywords(plugin, { registry: Constants.Registry })
                            .then(function (keywords) {
                                var resolver = new PluginTypeResolver(),
                                    pluginType = resolver.resolve(keywords);

                                renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...');
                                return install(plugin, {
                                    directory: path.join('src', pluginType.belongsTo),
                                    registry: Constants.Registry
                                });
                            })
                            .then(function (installed) {
                                if (!installed) throw new Error('The plugin was found but failed to download and install.');
                                renderer.log(chalk.green(plugin.packageName), 'has been installed successfully.');
                            });
                    });
                return Q.all(installations);
            })
            .then(function (){
                done(null);
            })
            .fail(RendererHelpers.reportFailure(renderer, done));
        }
    };
};