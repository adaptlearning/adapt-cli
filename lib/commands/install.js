var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    Q = require('q'),
    Constants = require('../Constants'),
    PluginTypeResolver = require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Project = require('../Project'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers'),
    uninstallPackage = require('../promise/uninstallPackage');

module.exports = {
    install: function (renderer) {
        var packageName = arguments.length >= 3 ? arguments[1] : null,
            location = arguments.length >= 4 ? arguments[2] : '',
            done = arguments[arguments.length-1] || function () {};

        var project = new Project(Constants.DefaultProjectManifestPath);
            plugins = packageName ? [Plugin.parse(packageName)] : project.plugins;

        var tasks = plugins.map(function (plugin) {
            project.add(plugin);

            return PackageMeta.getKeywords(plugin, { registry: Constants.Registry })
            .then(function (keywords) {
                var resolver = new PluginTypeResolver(),
                    pluginType = resolver.resolve(keywords);

                renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...');
                return install(plugin, { 
                    directory: path.join(location, 'src', pluginType.belongsTo),
                    registry: Constants.Registry
                });
            })
            .then(function (installed) {
                if(!installed) throw new Error('The plugin was found but failed to download and install.');
                renderer.log(chalk.green(plugin.packageName), 'has been installed successfully.');
            });
        });

        Q.all(tasks)
         .then(function () {
            done();
         })
         .fail(function (err) {
            renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err.message);
            done(err);
        });
    }
};

function install (plugin, config) {
    var deferred = Q.defer();

    bower.commands.install([plugin.toString()], { save: false }, config)
    .on('end', function(installed) {
        deferred.resolve(installed);
    })
    .on('error', function (err) {
        if(err.code !== 'ECONFLICT') {
            deferred.reject(err);
        }
        uninstallPackage(Plugin.parse(plugin.packageName), config)
        .then(function () {
            return install(plugin, config);
        })
        .then(function (installed) {
            deferred.resolve(installed);
        })
        .fail(function (err) {
            deferred.reject(err);
        });
    });
    return deferred.promise;
}