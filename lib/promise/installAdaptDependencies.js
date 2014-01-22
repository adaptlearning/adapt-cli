var chalk = require('chalk'),
    Q = require('q'),
    npm  = require('npm'),
    installCommand = require('../commands/install'),
    Constants = require('../Constants');

module.exports = function installAdaptDependencies (properties /* { renderer, localDir } */) {
    var deferred = Q.defer(),
        cwd = process.cwd();

    properties.renderer.log(chalk.cyan('installing adapt dependencies'));

    process.chdir(properties.localDir);
    installCommand.install(properties.renderer, null, function (err) {
        if(err) deferred.reject(err);
        
        process.chdir(cwd);
        deferred.resolve(properties);
    });
    return deferred.promise;
};