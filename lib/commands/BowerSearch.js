var bower = require('bower'),
    chalk = require('chalk');

module.exports = {
    search: function(renderer, searchTerm, done) {
        bower.commands.search(searchTerm, {})
        .on('end', function(results) {
            results.forEach(function (result) {
                renderer.log(chalk.cyan(result.name) + ' ' + result.url);
            });
        })
        .on('error', function () {
            renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."));
        });
    }
};