var bower = require('bower'),
    chalk = require('chalk'),
    _ = require('lodash'),
    prompt = require('prompt'),
    Q = require('q'),
    request = require('request'),
    Constants = require('../Constants'),
    Plugin = require('../Plugin'),
    authenticate = require('../promise/authenticate'),
    log;

module.exports = {
    rename: function (renderer) {
        log = renderer.log;

        var done = arguments[arguments.length-1] || function () {};
        
        if (arguments.length >= 4) {
            var params = {
                oldName:arguments[1],
                newName:arguments[2]
            };

            // use Plugin to standardise name
            params.newName = new Plugin(params.newName).packageName;

            log(chalk.yellow('Using registry at', Constants.getRegistry()));
            log(chalk.yellow('Plugin will be renamed to', params.newName));

             Q(params)
            .then(checkPluginNameExists)
            .then(checkNewPluginNameDoesNotExist)
            .then(authenticate)
            .then(confirm)
            .then(rename)
            .then(function() {
                log(chalk.green('The plugin was successfully renamed.'));
                done();
            })
            .catch(function (err) {
                log(chalk.red(err));
                log('The plugin was not renamed.');
                done(err);
            })
            .done();

        } else {
            log(chalk.red('You must call rename with the following arguments: <plugin name> <new plugin name>'));
            done();
        }
    }
};

function checkPluginNameExists(params) {
    return exists(params.oldName).then(function(exists) {
        return exists ? Q.resolve(params) : Q.reject('Plugin "'+params.oldName+'" does not exist');
    });
}

function checkNewPluginNameDoesNotExist(params) {
    return exists(params.newName).then(function(exists) {
        return exists ? Q.reject('Name "'+params.newName+'" already exists') : Q.resolve(params);
    });
}

function confirm(params) {
    var deferred = Q.defer();
    var schema = {
        properties: {
            ready: {
                description: chalk.cyan('Confirm rename now?'),
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
        if(!confirmation.ready) deferred.reject(new Error('Aborted. Nothing has been renamed.'));
        deferred.resolve(params);
    });
    return deferred.promise;
}

function rename(params) {
    var deferred = Q.defer();
    var path = 'packages/rename/'+params.username+'/'+params.oldName+'/'+params.newName;
    var query = '?access_token='+params.token;

    request({
        url: Constants.getRegistry()+'/'+path+query,
        method:'GET',
        headers: {'User-Agent':'adapt-cli'},
        followRedirect:false
    }, function(err, res, body) {
        if (err) {
            deferred.reject(err);
        } else {
            res.statusCode==201 ? deferred.resolve(params) : deferred.reject("The server responded with "+res.statusCode);
        }
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
