var bower = require('bower'),
    chalk = require('chalk'),
    Constants = require('../Constants'),
    Plugin = require('../Plugin');


module.exports = {
    search: function(renderer) {
        var searchTerm = arguments.length >= 3 ? arguments[1] : '',
            done = arguments[arguments.length -1] || function () {};
        
        var plugin = new Plugin(searchTerm);

        bower.commands.search(searchTerm,  { registry: Constants.Registry })
        .on('end', function(results) {
            if(!results.length) {
                renderer.log(chalk.yellow('no plugins found', plugin.toString()));
            }
            results.forEach(function (result) {
                renderer.log(chalk.cyan(result.name) + ' ' + result.url);
            });
            done();
        })
        .on('error', function (err) {
            renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."));
            done(err);
        });
    }
};