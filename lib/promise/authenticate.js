var bower = require('bower'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
    Q = require('q');

module.exports = function(properties) {
    return Q.fcall(ask, properties).then(login);
};

function ask(properties) {
    var deferred = Q.defer();
    var schema = [
        {
            name: 'username',
            message: chalk.cyan('GitHub username')
        },
        {
            name: 'password',
            message: chalk.cyan('GitHub password'),
            type: 'password',
            mask: '*'
        }
    ];
    inquirer.prompt(schema).then(confirmation => {
        properties.username = confirmation.username;
        properties.password = confirmation.password;
        deferred.resolve(properties);
    }).catch(err => deferred.reject(err));
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