var bower = require('bower'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
    path = require('path'),
    Q = require('q'),
    Constants = require('../Constants'),
    Plugin = require('../Plugin'),
    create = require('./create/index'),
    highest = require('../promise/highest'),
    _ = require('lodash');

module.exports = {
    create: function (renderer) {
        var type = arguments.length >= 3 ? arguments[1] : Constants.DefaultCreateType,
            localDir = arguments.length >= 4 ? arguments[2] : undefined,
            branch = arguments.length >= 5 ? arguments[3] : Constants.DefaultBranch,
            done = arguments[arguments.length-1];
        highest()
            .then(function (tag) {
                return confirm({
                    type: type,
                    localDir: localDir,
                    branch: tag,
                    renderer: renderer
                });
        })
        .then(function (properties) {
            var action = create[properties.type];
            if(!action) throw new Error('' + properties.type + ' is not a supported type');
            return action(properties);
        })
        .then(function () {
            done();
        })
        .fail(function (err) {
            renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err.message);
            done(err);
        });
    }
};

function confirm(properties) {
    var deferred = Q.defer(),
        renderer = properties.renderer;

    var typeSchema = [
        {
            name: 'type',
            choices: [ 'course', 'component' ],
            type: 'list',
            default: properties.type
        }
    ];

    inquirer.prompt(typeSchema).then(typeSchemaResults => {
        var propertySchema = [
            {
                name: 'localDir',
                message: 'name',
                type: 'input',
                default: properties.localDir || Constants.DefaultTypeNames[typeSchemaResults.type]
            },
            {
                name: 'branch',
                message: 'branch/tag',
                type: 'input',
                default: properties.branch || 'not specified'
            },
            {
                name: 'ready',
                message: 'create now?',
                type: 'confirm',
                default: true
            }
        ];

        inquirer.prompt(propertySchema).then(propertySchemaResults => {
            if(!propertySchemaResults.ready) deferred.reject(new Error('Aborted. Nothing has been created.'));

            var properties = _.extend({},
                typeSchemaResults,
                propertySchemaResults,
                {
                    renderer: renderer
                });
            deferred.resolve(properties);
        }).catch(err => deferred.reject(err));
    }).catch(err => deferred.reject(err));
    return deferred.promise;
}
