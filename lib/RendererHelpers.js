var chalk = require('chalk'),
    inquirer = require('inquirer'),
    Q = require('q');

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
    },
    reportInvalidFrameworkDirectory : function (renderer, done) {
        return function (err) {
            renderer.log(chalk.red('Fatal error: please run above commands in adapt course directory.'));
            done(err);
        };
    },
};

function confirm(plugin) {
    var deferred = Q.defer();
    var schema = [
        {
            name: 'continueWithInstall',
            message: 'Install this plugin anyway?',
            type: 'confirm',
            default: false
        }
    ];
    inquirer.prompt(schema).then(properties => {
        deferred.resolve({
            plugin: plugin,
            continueWithInstall: properties.continueWithInstall
        });
    }).catch(err => deferred.reject(err));
    return deferred.promise;
}
