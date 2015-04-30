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
        install = dependencies.install || require('../promise/install');

    return {
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
                        directory: path.join('src', pluginType.belongsTo),
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
};