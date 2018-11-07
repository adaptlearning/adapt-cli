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
        mkdirp = require('mkdirp'),
        exec = require('child_process').exec;

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
                    directory: path.join('src', pluginType.belongsTo),
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
                done = arguments[arguments.length-1] || function () {};

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

            function promiseFromChildProcess(child) {
                return new Promise(function (resolve, reject) {
                    child.addListener("error", reject);
                    child.addListener("exit", resolve);
                });
            }
            var child = exec(`git clone ${repository} "${localPath}"`);

            // clone the framework and all the bundled plugins.
            renderer.log("Cloning adapt_framework");
            promiseFromChildProcess(child)
            .then(function(repo){
                renderer.log("Framework cloned.");
                    clonePlugins(localPath, renderer, done);
            });
        }
    };
};
