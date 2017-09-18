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

    return {
        install: function (renderer) {
            var packageName = arguments.length >= 3 ? arguments[1] : null,
                done = arguments[arguments.length-1] || function () {};

            var project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath),
                plugins = packageName ? [Plugin.parse(packageName)] : project.plugins;

            var versionChecks = plugins.map(function (plugin) {
                return checkVersionCompatibilityTask(plugin, project);
            });

            Q.all(versionChecks)
             .then(function (checkedPlugins) {
                return getSequenceOfUserConfirmationTasks(checkedPlugins, renderer);
             })
             .then(function (confirmedPlugins) {
                var installations = confirmedPlugins.filter(function (result) {
                        return result.continueWithInstall === true;
                    })
                    .map(function (result) {
                        project.add(result.plugin);
                        return createInstallationTask(result.plugin, renderer);
                    });
                return Q.all(installations);
            })
            .then(function (){
                done(null);
            })
            .fail(RendererHelpers.reportFailure(renderer, done));
        }
    };




    function checkVersionCompatibilityTask(plugin, project) {
         return PackageMeta.getFrameworkCompatibility(plugin)
                           .then(function (versionRange) {
                               return {
                                   plugin: plugin,
                                   isCompatible: VersionChecker.assertVersionCompatibility(project.getFrameworkVersion(), versionRange)
                               };
                           });
    }

    function getSequenceOfUserConfirmationTasks(checkedPlugins, renderer) {
        return promise.serialise(checkedPlugins, function (result) {
            if (!result.isCompatible) {
                return RendererHelpers.reportCompatibilityWarning(renderer, result.plugin);
            }

            result.continueWithInstall = true;
            return Q(result);
        });
    }

    function createInstallationTask(plugin, renderer) {
        return PackageMeta.getKeywords(plugin, { registry: Constants.Registry })
                          .then(function (keywords) {
                              var resolver = new PluginTypeResolver(),
                                  pluginType = resolver.resolve(keywords);

                              renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...');
                              return install(plugin, {
                                  /*directory: path.join('src', pluginType.belongsTo),*/
                                  registry: Constants.Registry
                              });
                          })
                          .then(function (installed) {
                              if (!installed) throw new Error('The plugin was found but failed to download and install.');
                              renderer.log(chalk.green(plugin.packageName), 'has been installed successfully.');
                          });
    }
};