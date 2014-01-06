var bower = require('bower'),
    chalk = require('chalk'),
    prompt = require('prompt'),
    path = require('path'),
    _ = require('lodash'),
    Q = require('q'),
    Constants = require('../Constants'),
    JsonLoader = require('../JsonLoader'),
    PluginTypeResolver = require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Project = require('../Project'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers');

module.exports = {
    register: function (renderer, done) {
        done = arguments[arguments.length-1] || function () {};

        renderer.log(chalk.yellow('This will publish this plugin to', bower.config.registry.publish));

        loadPluginProperties('./bower.json', {
            name: undefined,
            repository: undefined
        })
        .then(confirm)
        .then(function (properties) {
        var plugin = new Plugin(properties.name),
            contribPlugin = new Plugin(properties.name, true),
            searches = [exists(contribPlugin)];

        if(!plugin.isContrib) {
            searches.push(exists(plugin));
        }

        return Q.all(searches)
                .spread(function (contribExists, pluginExists) {
                    if(contribExists) {
                        return reportExistance(contribPlugin, renderer);
                    }
                    if(pluginExists) {
                        return reportExistance(plugin, renderer);
                    }
                    return register(plugin, properties.repository)
                });
        })
        .fail(function (err) {
        renderer.log(chalk.red(err));
        done(err);
        });
    }
};

function loadPluginProperties(path, defaults) {
    var deferred = Q.defer();

    path = path || './bower.json';

    if(!JsonLoader.existsSync(path)) {
        deferred.reject(new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.'));
    }
    JsonLoader.readJSON(path, function (data) {
        deferred.resolve(_.extend({}, defaults, data));
    });

    return deferred.promise; 
}

function confirm(properties) {
    var deferred = Q.defer();
    var plugin = new Plugin(properties.name),
        schema = {
            properties: {
                name: {
                    description: 'name',
                    pattern: /^adapt-[\w|-]+?$/,
                    message: "Name must prefixed with 'adapt' and each word separated with a hyphen(-)",
                    type: 'string',
                    default: plugin.toString() || 'not specified',
                    required: true
                },
                repository: {
                    description: 'repository',
                    pattern: /([A-Za-z0-9]+@|http(|s)|git\:\/\/)([A-Za-z0-9.]+)(:|\/)([A-Za-z0-9\-\.\/]+)(\.git)?/,
                    type: 'string',
                    default: properties.repository || 'not specified',
                    required: true
                },
                ready: {
                    description: 'Register now?',
                    message: 'Please specify (y)es or (n)o',
                    pattern: /^y$|^n$/i,
                    type: 'string',
                    default: 'y',
                    required: true,
                    before: function(value) { return /^y$/i.test(value); }
                }
            }
        };
    prompt.message = chalk.cyan('Confirm');
    prompt.delimiter = ' ';
    prompt.start();
    prompt.get(schema, function (err, properties) {
        if(err) return deferred.reject(err);
        if(!properties.ready) deferred.reject(new Error('Aborted. Nothing has been registered.'));

        deferred.resolve(properties);
    });
    return deferred.promise;
}

function register(plugin, repository) {
    var deferred = Q.defer();

    bower.commands.register(plugin.toString(), repository)
    .on('end', function(result) {
        console.log('register complete', result);
        deferred.resolve(result);
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

function exists(plugin) {
    var deferred = Q.defer();

    bower.commands.search(plugin.toString())
    .on('end', function(result) {
        var matches = result.filter(exactMatch(plugin.toString()));
        deferred.resolve(!!matches.length);
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

function exactMatch(pattern) {
    return function (item) {
        var regexp = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
        return regexp.test(item.name);
    };
}

function reportExistance(plugin, renderer) {
    renderer.log(chalk.yellow(plugin.toString()), chalk.cyan('has been previously registered. Plugin names must be unique. Try again with a different name.'));
}