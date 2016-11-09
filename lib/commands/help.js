var fs = require('fs'),
    path = require('path'),
    chalk = require('chalk'),
    _ = require('lodash');

module.exports = {
    help: function (renderer) {

        var name = arguments.length >= 3
                   ? arguments.length > 3
                     ? Array.prototype.slice.apply(arguments, [1, arguments.length -1]).join(' ')
                     : arguments[1]
                   : '';
        var json;

        if (name) {
            json = path.resolve(__dirname, '../../json/help-' + name.replace(/\s+/g, '/') + '.json');
        } else {
            json = path.resolve(__dirname, '../../json/help.json');
        }

        fs.exists(json, function(exists) {
            if (!exists) {
                renderer.log('adapt ' + chalk.red(name) + '   Unknown command: ' + name);
            } else {

                var jsonData = require(json);

                renderer.log('\nUsage: \n');
                _.each(jsonData.usage, function(usage) {
                    renderer.log('    ' + chalk.cyan('adapt') + ' ' + usage);
                });

                if(!_.isEmpty(jsonData.commands)) {
                    renderer.log('\n\nwhere <command> is one of:\n');
                    _.each(jsonData.commands, function(description, command) {
                        renderer.log('    ' + command + new Array(23 - command.length).join(' ') + description);
                    });
                }

                if(jsonData.description) {
                    renderer.log('\nDescription:\n\n    ' + jsonData.description);
                }

                if(!name) {
                    renderer.log('\nSee \'adapt help <command>\' for more information on a specific command.\n');
                }
            }
        });

    }
};
