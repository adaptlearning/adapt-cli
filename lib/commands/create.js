var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    prompt = require('prompt'),
    Q = require('q'),
    Constants = require('../Constants'),
    Plugin = require('../Plugin'),
    create = require('./create/index'),
    _ = require('lodash');

module.exports = {
    create: function (renderer) {
        var type = arguments.length >= 3 ? arguments[1] : Constants.DefaultCreateType,
            localDir = arguments.length >= 4 ? arguments[2] : undefined,
            branch = arguments.length >= 5 ? arguments[3] : Constants.DefaultBranch,
            done = arguments[arguments.length-1];

        confirm({
            type: type,
            localDir: localDir,
            branch: branch,
            renderer: renderer
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

    var typeSchema = {
        properties: {
            type: {
                description: 'type',
                pattern: /^course$|^component$/,
                type: 'string',
                default: properties.type,
                required: true
            }
        }
    };

    prompt.message = chalk.cyan('Confirm');
    prompt.delimiter = ' ';
    prompt.start();
    prompt.get(typeSchema, function (err, typeSchemaResults) {
        var propertySchema = {
            properties: {
                localDir: {
                    description: 'name',
                    pattern: /\w/,
                    type: 'string',
                    default: properties.localDir || Constants.DefaultTypeNames[typeSchemaResults.type],
                    required: true
                },
                branch: {
                    description: 'branch',
                    pattern: /\w/,
                    type: 'string',
                    default: properties.branch || 'not specified',
                    required: true
                },
                ready: {
                    description: 'create now?',
                    message: 'Please specify (y)es or (n)o',
                    pattern: /^y$|^n$/i,
                    type: 'string',
                    default: 'y',
                    required: true,
                    before: function(value) { return /^y$/i.test(value); }
                }
            }
        };

        prompt.get(propertySchema, function (err, propertySchemaResults) {
            if(err) return deferred.reject(err);
            if(!propertySchemaResults.ready) deferred.reject(new Error('Aborted. Nothing has been created.'));

            var properties = _.extend({},
                typeSchemaResults,
                propertySchemaResults,
                {
                    renderer: renderer
                });
            deferred.resolve(properties);
        });
    });
    return deferred.promise;
}
