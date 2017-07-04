var bower = require('bower'),
    chalk = require('chalk'),
    prompt = require('prompt'),
    Q = require('q');

module.exports = function(properties) {
    return Q.fcall(ask, properties).then(login);
};

function ask(properties) {
    var deferred = Q.defer();
    var schema = {
        properties: {
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