var bower = require('bower'),
    chalk = require('chalk'),
    inquirer = require('inquirer'),
    path = require('path'),
    Q = require('q'),
    fs = require('q-io/fs'),
    Plugin = require('../../Plugin'),
    getRepository = require('../../promise/getRepository'),
    removeTemporaryDownload = require('../../promise/removeTemporaryDownload'),
    installNodeDependencies = require('../../promise/installNodeDependencies'),
    installAdaptDependencies = require('../../promise/installAdaptDependencies'),
    _ = require('lodash');

module.exports = function (properties) {
    var progress = _.throttle(function () {
        properties.renderer.write(chalk.grey('.'));
    }, 300);

    return deleteExistingCourse(properties)
        .then(function (properties) {
            properties.renderer.write(chalk.cyan('downloading framework to', properties.localDir, '\t'));
            return properties;
        })
        .then(getRepository)
        .progress(function (data) {
            progress();
            return data;
        })
        .then(function (properties) {
            properties.renderer.log(' ', 'done!');
            return properties;
        })
        .then(removeTemporaryDownload)
        .then(installNodeDependencies)
        .then(installAdaptDependencies)
        .then(function (properties) {
            properties.renderer.log('\n' + chalk.green(properties.localDir), 'has been created.\n');

            properties.renderer.log(chalk.grey('To build the course, run:') +
                '\n\tcd ' + properties.localDir +
                '\n\tgrunt build\n');

            properties.renderer.log(chalk.grey('Then to view the course, run:') +
                '\n\tgrunt server\n');
        });

};

function deleteExistingCourse(properties) {
    return fs.exists(properties.localDir)
        .then(function (exists) {
            if(exists) {
                var deferred = Q.defer();

                inquirer.prompt([
                    {
                        name: 'overwrite existing course?',
                        type: 'confirm',
                        default: false
                    }
                ]).then(results => {
                    if(results['overwrite existing course?']) {
                        fs.removeTree(properties.localDir)
                            .then(function (){
                                deferred.resolve(properties);
                            })
                            .fail(function (err) {
                                deferred.reject(err);
                            });
                    } else {
                        deferred.reject(new Error('Course already exists and cannot overwrite.'));
                    }
                }).catch(err => deferred.reject(err));

                return deferred.promise;
            }
        })
        .then(function () {
            return properties;
        });
}
