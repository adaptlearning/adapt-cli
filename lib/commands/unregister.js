var bower = require('bower'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
    _ = require('lodash'),
    Q = require('q'),
    request = require('request'),
    Constants = require('../Constants'),
    JsonLoader = require('../JsonLoader'),
    authenticate = require('../promise/authenticate'),
    log;

module.exports = {
    unregister: function (renderer) {
        log = renderer.log;

        var done = arguments[arguments.length-1] || function () {};
        var pluginName;

        if (arguments.length >= 3) {
            pluginName = arguments[1];
        }

        log(chalk.yellow('This will unregister the plugin at', Constants.getRegistry()));
        
         getProperties(pluginName)
        .then(authenticate)
        .then(confirm)
        .then(unregister)
        .then(function() {
            log(chalk.green('The plugin was successfully unregistered.'));
            done();
        })
        .catch(function (err) {
            log(chalk.red(err));
            log('The plugin was not unregistered.');
            done(err);
        })
        .done();
    }
};

function getProperties(pluginName) {
    if (pluginName) {
        return Q.resolve({name:pluginName});
    }

    return loadPluginProperties('./bower.json');
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

function confirm(properties) {
    var deferred = Q.defer();
    var schema = [
        {
            name: 'ready',
            message: chalk.cyan('Confirm Unregister now?'),
            type: 'confirm',
            default: true
        }
    ];
    inquirer.prompt(schema).then(confirmation => {
        if(!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been unregistered.'));
        deferred.resolve(properties);
    }).catch(err => deferred.reject(err));
    return deferred.promise;
}

function unregister(properties) {
    var deferred = Q.defer();
    
    // user (username) with OAuth (token) wants to unregister the registered plugin (name) from registry
    bower.commands.unregister(properties.username+'/'+properties.name, {token:properties.token, registry: Constants.getRegistry()})
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
