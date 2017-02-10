var bower = require('bower'),
    chalk = require('chalk'),
    gh = require('parse-github-url'),
    _ = require('lodash'),
    path = require('path'),
    prompt = require('prompt'),
    Q = require('q'),
    request = require('request'),
    Constants = require('../Constants'),
    JsonLoader = require('../JsonLoader'),
    JsonWriter = require('../JsonWriter'),
    Project = require('../Project'),
    Plugin = require('../Plugin'),
    log;

module.exports = {
    unregister: function (renderer) {
        log = renderer.log;

        var done = arguments[arguments.length-1] || function () {};

        log(chalk.yellow('This will unregister the plugin at', bower.config.registry.publish));
        
         getProperties(arguments.length >= 3 ? arguments[1] : null)
        .then(validate)
        .then(authorize)
        .then(login)
        .then(confirm)
        .then(unregister)
        .then(function() {
            log(chalk.green('The plugin was successfully unregistered.'));
            done();
        })
        .catch(function (err) {
            log(chalk.red(err));
            log('The plugin could not be unregistered.');
            done(err);
        })
        .done();
    }
};

function getProperties(repo) {
    var parsed;
    var errStr = "Please supply a repository in the format [owner/name] or supply a GitHub endpoint";

    if (repo) {
        parsed = gh(repo);

        return parsed.repo ? Q.resolve({repository:'https://github.com/'+parsed.repo}) : Q.reject(errStr);
    }

    return loadPluginProperties('./bower.json', {repository: undefined});
}

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

function validate(properties) {
    var deferred = Q.defer();
    var errStr = "Please supply a repository in the format [owner/name] or supply a GitHub endpoint";

    request({
        url: properties.repository,
        method:'GET',
        headers: {'User-Agent':'adapt-cli'},
        followRedirect:false
    }, function(err, res, body) {
        if (err) {
            deferred.reject(err);
        } else {
            res.statusCode==404 ? deferred.reject(errStr) : deferred.resolve(properties);
        }
    });

    return deferred.promise;
}

function authorize(properties) {
    var deferred = Q.defer();
    var schema = {
        properties: {
            repository: {
                description: chalk.cyan('Confirm repository'),
                pattern: /([A-Za-z0-9]+@|http(|s)|git\:\/\/)([A-Za-z0-9.]+)(:|\/)([A-Za-z0-9\-\.\/]+)(\.git)?/,
                type: 'string',
                default: properties.repository || 'not specified',
                required: true
            },
            username: {
                description: chalk.cyan('GitHub username'),
                required: true
            },
            password: {
                description: chalk.cyan('GitHub password'),
                hidden: true,
                replace: '*',
                required: true
            }
        }
    };
    prompt.message = '';
    prompt.delimiter = ' ';
    prompt.start();
    prompt.get(schema, function (err, confirmation) {
        if(err) return deferred.reject(err);
        properties.repository = confirmation.repository;
        properties.username = confirmation.username;
        properties.password = confirmation.password;
        deferred.resolve(properties);
    });
    return deferred.promise;
}

function login(properties) {
    var deferred = Q.defer();

    bower.commands.login(properties.repository, {interactive:true})
    .on('prompt', function (prompts, callback) {
        callback({
            username:properties.username,
            password:properties.password
        });
    })
    .on('end', function (result) {
        if (!result || !result.token) {
            deferred.reject();
        }
        else {
            //log('end', result);
            //log('token ',result.token);
            properties.token = result.token;
            deferred.resolve(properties);
        }
    })
    .on('error', function (err) {
        //log('login:error', err);
        deferred.reject(err);
    });
    return deferred.promise;
}

function confirm(properties) {
    var deferred = Q.defer();
    var schema = {
        properties: {
            ready: {
                description: chalk.cyan('Confirm Unregister now?'),
                message: 'Please specify (y)es or (n)o',
                pattern: /^y$|^n$/i,
                type: 'string',
                default: 'y',
                required: true,
                before: function(value) { return /^y$/i.test(value); }
            }
        }
    };
    prompt.message = '';
    prompt.delimiter = ' ';
    prompt.start();
    prompt.get(schema, function (err, confirmation) {
        if(err) return deferred.reject(err);
        if(!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been unregistered.'));
        deferred.resolve(properties);
    });
    return deferred.promise;
}

function unregister(properties, renderer) {
    var deferred = Q.defer();

    // user [username] with OAuth [token] wants to unregister owner/name [repo]
    bower.commands.unregister(gh(properties.repository).repo+'/'+properties.username, {token:properties.token})
    .on('end', function (result) {
        //log('end', result);
        deferred.resolve();
    })
    .on('error', function (err) {
        //log('error', err);
        deferred.reject(err);
    });
    return deferred.promise;
}
