var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    Q = require('q'),
    PluginTypeResolver = require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers');


module.exports = {
    uninstall: function (renderer) {

        var packageName = arguments.length >= 3 ? arguments[1] : null,
            done = done || function () {};

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
        .fail(RendererHelpers.reportFailure(renderer, done));
    }
};

function uninstall (plugin, config) {
    var deferred = Q.defer();

    bower.commands.uninstall([plugin.toString()], {}, config)
    .on('end', function(installed) {
        deferred.resolve(installed);
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

