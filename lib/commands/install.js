var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    Q = require('q'),
    PluginTypeResolver = require('../PluginTypeResolver')
    Plugin = require('../Plugin');


module.exports = {
    install: function (renderer, packageName, done) {
        done = done || function () {};
        
        var plugin = new Plugin(packageName),
            resolver = new PluginTypeResolver();

        getKeywords(plugin)
        .then(function (keywords) {
            renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', resolver.resolve(keywords).typename, '...');
            return install(plugin, { directory: path.join('src', 'plugins') });
        })
        .then(function (installed) {
            if(!installed) throw new Error('The plugin was found but failed to download and install.')
            
            renderer.log(chalk.cyan(plugin.packageName), 'has been installed successfully.');
            done();
        })
        .fail(reportFailure(renderer, done));
    },
    uninstall: function (renderer, packageName, done) {
        done = done || function () {};

        var plugin = new Plugin(packageName);

        renderer.log('Uninstalling', chalk.cyan(plugin.packageName));

        uninstall(plugin.toString(), { directory: path.join('src', 'plugins') })
        .fail(reportFailure(renderer, done));
    }
};

function getKeywords (plugin, config) {
    var deferred = Q.defer();
    
    bower.commands.info(plugin.toString(), 'keywords', config || {})
    .on('end', function(results) {
        deferred.resolve(results);
    })
    .on('error', function(err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

function install (plugin, config) {
    var deferred = Q.defer();

    bower.commands.install([plugin.toString()], { save: true }, config)
    .on('end', function(installed) {
        deferred.resolve(installed);
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

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

function reportFailure (renderer, done) {
    return function (err) {
        renderer.log(chalk.red('Oh dear, something went wrong.'), err.message);
        done(err);
    };
}