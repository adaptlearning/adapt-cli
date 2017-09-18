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
        install = dependencies.install || require('../promise/install'),
        cloneInstall = dependencies.cloneInstall || require('../promise/cloneInstall'),
        nodegit = require('nodegit'),
        mkdirp = require('mkdirp');

    function clonePlugins(localPath, renderer) {
        renderer.log("Cloning Plugins");

        var project = new Project(
                path.resolve(localPath, Constants.DefaultProjectManifestPath),
                path.resolve(localPath, Constants.DefaultProjectFrameworkPath)
            ),
            plugins = project.plugins;



        plugins.forEach(function(plugin, index, array) {
            createInstallationTask(plugin, localPath, renderer);
        });
    }


    function createInstallationTask(plugin, localPath, renderer) {
        return PackageMeta.getKeywords(plugin, { registry: Constants.Registry })
            .then(function (keywords) {
                var resolver = new PluginTypeResolver(),
                    pluginType = resolver.resolve(keywords);

                renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...');
                return cloneInstall(plugin, {
                    localPath: localPath,
                    /*directory: path.join('src', pluginType.belongsTo),*/
                    registry: Constants.Registry
                });
            })
            .then(function (installed) {
                if (!installed) throw new Error('The plugin was found but failed to download and install.');
                renderer.log(chalk.green(plugin.packageName), 'has been installed successfully.');
            })
            .done();
    }

    return {
        devinstall: function (renderer) {

            var repository = arguments.length >= 3 ? arguments[1] : Constants.FrameworkRepository,
                localPath = path.resolve(Constants.FrameworkRepositoryName),
                done = arguments[arguments.length-1] || function () {},
                clone = nodegit.Clone.clone;

            try {
                // Are we inside an existing adapt_framework project.
                var packageJson = require(process.cwd() + '/package.json');
                if (packageJson.name === 'adapt_framework') {
                    localPath = process.cwd();
                }
            } catch (err) {
                // Don't worry, we're not inside a framework directory.
            }

            // we're trying to install a single plugin.
            if (repository !== Constants.FrameworkRepository) {
                return createInstallationTask(Plugin.parse(repository), localPath, renderer)
            }

            // handle repositories that already exist locally
            var errorAndAttemptOpen = function () {
                return nodegit.Repository.open(localPath);
            };

            // clone the framework and all the bundled plugins.
            renderer.log("Cloning adapt_framework");
            clone(repository, localPath, null)
                .catch(errorAndAttemptOpen)
                .then(function(repo){
                    repo.getCurrentBranch().then(function(branch){
                        renderer.log("Framework cloned.");
                        clonePlugins(localPath, renderer, done);
                    });
                });

        }
    };
};