var chalk = require('chalk'),
    fs = require('fs'),
    path = require('path'),
    rimraf = require('rimraf'),
    Q = require('q'),
    Constants = require('../Constants'),
    PluginTypeResolver =  require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Project =  require('../Project'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers'),
    uninstallPackage = require('../promise/uninstallPackage'),
    Errors = require('../errors');

module.exports = {
    apiuninstall:function(pluginName, cwd) {
        if (cwd) process.chdir(cwd);

        var project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);

        if(!project.isProjectContainsManifestFile()) {
            return Q.reject({error:Errors.ERROR_COURSE_DIR});
        }

        var plugin = Plugin.parse(pluginName);
        var deferred = Q.defer();

        PackageMeta.getKeywords(plugin, { registry: Constants.getRegistry() })
        .then(function (keywords) {
            var resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);

            return uninstallPackage(plugin, {
                directory: path.join('src', pluginType.belongsTo)
            });
        })
        .then(function () {
            project.remove(plugin);
        })
        .then(function () {
            deferred.resolve(pluginName);
        })
        .fail(function() {
            // will fail if plugin has not been installed by Bower (i.e. the .bower.json manifest is missing)
            // so just try and remove the directory (this is basically what Bower does anyway)

            var removePath;
            
            ['components', 'extensions', 'menu', 'theme'].forEach(function(pluginType) {
                var pluginPath = path.join('src', pluginType, plugin.packageName);
                
                if (fs.existsSync(pluginPath)) {
                    removePath = pluginPath;
                }
            });

            if (removePath) {
                rimraf(removePath, function() {
                    if (fs.existsSync(removePath)) {
                        deferred.reject({error:Errors.ERROR_UNINSTALL});
                    } else {
                        project.remove(plugin);
                        deferred.resolve(pluginName);
                    }
                });
            } else {
                deferred.reject({error:Errors.ERROR_NOT_FOUND});
            }
        });

        return deferred.promise;
    },
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

        PackageMeta.getKeywords(plugin, { registry: Constants.getRegistry() })
        .then(function (keywords) {
            var resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);

            renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Uninstalling', pluginType.typename, '...');
            return uninstallPackage(plugin, {
                directory: path.join('src', pluginType.belongsTo)
            });
        })
        .then(function () {
            project.remove(plugin);
        })
        .then(function () {
            done();
        })
        .fail(function() {
            // will fail if plugin has not been installed by Bower (i.e. the .bower.json manifest is missing)
            // so just try and remove the directory (this is basically what Bower does anyway)

            var removePath;
            
            ['components', 'extensions', 'menu', 'theme'].forEach(function(pluginType) {
                var pluginPath = path.join('src', pluginType, plugin.packageName);
                
                if (fs.existsSync(pluginPath)) {
                    removePath = pluginPath;
                }
            });

            if (removePath) {
                rimraf(removePath, function() {
                    if (fs.existsSync(removePath)) {
                        RendererHelpers.reportFailure(renderer, done);
                    } else {
                        project.remove(plugin);
                        done();
                    }
                });
            } else {
                RendererHelpers.reportFailure(renderer, done);
            }
        });
    }

};
