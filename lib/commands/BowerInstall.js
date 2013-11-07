var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    Q = require('q'),
    PluginTypeResolver = require('../PluginTypeResolver')
    Plugin = require('./Plugin');


module.exports = {
    install: function(renderer, packageName, done) {
        done = done || function () {};
        
        var plugin = new Plugin(packageName),
            resolver = new PluginTypeResolver();

        getKeywords(plugin)
        .then(function (keywords) {
            return install(plugin, { directory: path.join('src', resolver.resolve(keywords).belongsTo) });
        })
        .then(function (installed) {
            if(!installed) throw new Error('The plugin was found but failed to download and install.')
            
            renderer.log(chalk.cyan(plugin.packageName), 'has been installed successfully.');
            done();
        })
        .fail(function (err) {
            renderer.log(chalk.red('Oh dear, something went wrong.'), err.message);
            done(err);
        });
    }
};


function getKeywords(plugin, config) {
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

function install(plugin, config) {
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