var bower = require('bower'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
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

        //renderer.log(chalk.yellow('This will publish this plugin to', Constants.Registry));

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
        schema = [
            {
                name: 'name',
                message: chalk.cyan('name'),
                validate: v => {
                    return /^adapt-[\w|-]+?$/.test(v) ||
                        `Name must prefixed with 'adapt' and each word separated with a hyphen(-)`;
                },
                type: 'input',
                default: plugin.toString() || 'not specified'
            },
            {
                name: 'repositoryUrl',
                message: chalk.cyan('repository URL'),
                validate: v => {
                    return /git:\/\/([\w\.@\:/\-~]+)(\.git)(\/)?/.test(v) ||
                        'Please provide a repository URL of the form git://<domain><path>.git';
                },
                type: 'input',
                default: properties.repository ? properties.repository.url : undefined
            },
            {
                name: 'framework',
                message: chalk.cyan('framework'),
                validate: v => {
                    return semver.validRange(v) !== null ||
                        'Please provide a valid semver (see https://semver.org/)';
                },
                type: 'input',
                default: properties.framework || '~2.0.0'
            },
            {
                name: 'ready',
                message: chalk.cyan('Register now?'),
                type: 'confirm',
                default: true
            }
        ];
    inquirer.prompt(schema).then(confirmation => {
        if(!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been registered.'));

        properties.name = confirmation.name;
        properties.repository = {type:'git', url:confirmation.repositoryUrl};
        properties.framework = confirmation.framework;

        deferred.resolve(properties);
    }).catch(err => deferred.reject(err));
    return deferred.promise;
}

function register(plugin, repository) {
    var deferred = Q.defer();

    bower.commands.register(plugin.toString(), repository.url || repository, { registry: Constants.getRegistry() })
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

    bower.commands.search(plugin.toString(),  { registry: Constants.getRegistry() })
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
