var chalk = require('chalk'),
    prompt = require('prompt'),
    Q = require('Q');

module.exports = {
    reportCompatibilityWarning : function (renderer, plugin) {
        renderer.log(chalk.yellow('The plugin'), chalk.white(plugin), chalk.yellow('is not compatible with this version of Adapt.', 'Installing it may cause unexpected behaviour.'));
        return confirm(plugin);
    },
    reportFailure : function (renderer, done) {
        return function (err) {
            renderer.log(chalk.red('Oh dear, something went wrong.'), err.message);
            done(err);
        };
    }
};

function confirm(plugin) {
    var deferred = Q.defer();
    var schema = {
            properties: {
                continueWithInstall: {
                    description: 'Install this plugin anyway?',
                    message: 'Please specify (y)es or (n)o',
                    pattern: /^y$|^n$/i,
                    type: 'string',
                    default: 'n',
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

        deferred.resolve({
            plugin: plugin,
            continueWithInstall: properties.continueWithInstall
        });
    });
    return deferred.promise;
}