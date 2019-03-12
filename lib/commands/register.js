var bower = require('bower'),
    chalk = require('chalk'),
    prompt = require('prompt'),
    path = require('path'),
    _ = require('lodash'),
    Q = require('q'),
    Constants = require('../Constants'),
    JsonLoader = require('../JsonLoader'),
    JsonWriter = require('../JsonWriter'),
    Project = require('../Project'),
    Plugin = require('../Plugin'),
    semver = require('semver');

module.exports = {
    register: function (renderer) {
        var done = arguments[arguments.length-1] || function () {};

        renderer.log(chalk.yellow('This will publish this plugin to', Constants.Registry));

        var c = semver.coerce(">=2.2");

        loadPluginProperties('./bower.json', {
            name: undefined,
            repository: undefined,
            framework: undefined
        })
        .then(confirm)
        .then(function (properties) {
            savePluginProperties('./bower.json', properties);
            return properties;
        })
        .then(function (properties) {
            // given a package name, create two Plugin representations
            // if supplied name is adapt-contrib-myPackageName do a check against this name only
            // if suppled name is adapt-myPackageName check against this name and adapt-contrib-myPackageName
            // becase we don't want to allow adapt-myPackageName if adapt-contrib-myPackageName exists
            var plugin = new Plugin(properties.name),
                contribPlugin = new Plugin(properties.name, true),
                searches = [exists(contribPlugin)];

            if(!plugin.isContrib) {
                searches.push(exists(plugin));
            }

            return Q.all(searches)
                    .spread(function (contribExists, pluginExists) {
                        if(contribExists) {
                            return reportExistence(contribPlugin, renderer);
                        }
                        if(pluginExists) {
                            return reportExistence(plugin, renderer);
                        }
                        return register(plugin, properties.repository);
                    });
        })
        .then(function (registered) {
            if(!registered.result) throw new Error('The plugin was unable to register.');
            renderer.log(chalk.green(registered.plugin.packageName), 'has been registered successfully.');
            done();
        })
        .fail(function (err) {
            renderer.log(chalk.red(err));
            done(err);
        })
        .done();
    }
};

function loadPluginProperties(path, defaults) {
    var deferred = Q.defer();

    path = path || './bower.json';

    if(!JsonLoader.existsSync(path)) {
        deferred.reject(new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.'));
    }
    JsonLoader.readJSON(path, function (error, data) {
        if(error) {
            deferred.reject(new Error(error));
        } else {
            deferred.resolve(_.extend({}, defaults, data));
        }
    });

    return deferred.promise;
}

function savePluginProperties(path, values) {
    var deferred = Q.defer();

    path = path || './bower.json';

    if(!JsonWriter.existsSync(path)) {
        deferred.reject(new Error('bower.json is not in the current working directory. Plugins must be a valid bower package.'));
    }
    JsonWriter.writeJSON(path, values, function () {
        deferred.resolve(true);
    });

    return deferred.promise;
}

function confirm(properties) {
    var deferred = Q.defer();
    var plugin = new Plugin(properties.name),
        schema = {
            properties: {
                name: {
                    description: chalk.cyan('name'),
                    pattern: /^adapt-[\w|-]+?$/,
                    message: "Name must prefixed with 'adapt' and each word separated with a hyphen(-)",
                    type: 'string',
                    default: plugin.toString() || 'not specified',
                    required: true
                },
                repositoryType: {
                    description: chalk.cyan('repository type (e.g. git)'),
                    message: 'Please provide a repository type',
                    pattern: /.+/,
                    type: 'string',
                    default: properties.repository ? properties.repository.type : undefined,
                    required: true
                },
                repositoryUrl: {
                    description: chalk.cyan('repository URL'),
                    message: 'Please provide a repository URL of the form [git@][<protocol>]<domain><path>.git',
                    pattern: /((git|ssh|http(s)?)|(git@[\w\.]+))(:(\/\/)?)([\w\.@\:/\-~]+)(\.git)(\/)?/,
                    type: 'string',
                    default: properties.repository ? properties.repository.url : undefined,
                    required: true
                },
                framework: {
                    description: chalk.cyan('framework'),
                    message: 'Please provide a valid semver (see https://semver.org/)',
                    conform:function(v) {
                        return semver.valid(semver.coerce(v));
                    },
                    errors:['fooble'],
                    type: 'string',
                    default: properties.framework || '~2.0.0',
                    required: false
                },
                ready: {
                    description: chalk.cyan('Register now?'),
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
    prompt.get(schema, function (err, confirmation) {
        if(err) return deferred.reject(err);
        if(!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been registered.'));

        properties.name = confirmation.name;

        if (confirmation.repositoryType && confirmation.repositoryUrl) {
            properties.repository = {type:confirmation.repositoryType, url:confirmation.repositoryUrl};
        }

        properties.framework = confirmation.framework;

        deferred.resolve(properties);
    });
    return deferred.promise;
}

function register(plugin, repository) {
    var deferred = Q.defer();

    bower.commands.register(plugin.toString(), repository, { registry: Constants.Registry })
    .on('end', function(result) {
        deferred.resolve({ result: result, plugin: plugin });
    })
    .on('error', function (err) {
        deferred.reject(err);
    });
    return deferred.promise;
}

function exists(plugin) {
    var deferred = Q.defer();

    bower.commands.search(plugin.toString(),  { registry: Constants.Registry })
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
         if (typeof pattern === 'string') {
            if (pattern.toLowerCase() === item.name.toLowerCase()) {
                return true;
            } 
            return false
        }
        var regexp = new RegExp(pattern, 'i');
        return regexp.test(item.name);
    };
}

function reportExistence(plugin, renderer) {
    renderer.log(chalk.yellow(plugin.toString()), chalk.cyan('has been previously registered. Plugin names must be unique. Try again with a different name.'));
}
