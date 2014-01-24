var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    Q = require('q'),
    PluginTypeResolver = require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Constants = require('../Constants'),
    Project = require('../Project'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers');


module.exports = {
    uninstall: function (renderer) {

        var packageName = arguments.length >= 3 ? arguments[1] : null,
            done = arguments[arguments.length -1];

        if(!packageName) {
            return renderer.log(chalk.red('Please specify a plugin to uninstall.'));
        }

        var plugin = new Plugin(packageName);

        PackageMeta.getKeywords(plugin)
        .then(function (keywords) {
            var resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);

            renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Uninstalling', pluginType.typename, '...');
            return uninstall(plugin, { 
                directory: path.join('src', pluginType.belongsTo)
            });
        })
        .then(function (uninstalled) {
            if(uninstalled) {
                var project = new Project(Constants.DefaultProjectManifestPath);
                project.remove(plugin);
            }
        })
        .then(function () {
            done();
        })
        .fail(RendererHelpers.reportFailure(renderer, done));
    }
};

function uninstall (plugin, config) {
    var deferred = Q.defer();

    bower.commands.uninstall([plugin.toString()], {}, config)
    .on('end', function(uninstalled) {
        deferred.resolve(!!uninstalled);
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}
