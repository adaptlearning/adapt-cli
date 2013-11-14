var bower = require('bower'),
    chalk = require('chalk'),
    Plugin = require('../Plugin');


module.exports = {
    search: function(renderer, searchTerm, done) {
        done = done || function () {};
        
        var plugin = new Plugin(searchTerm);

        bower.commands.search(plugin.toString(), {})
        .on('log', function (text) {
            renderer.log(text)
        })
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