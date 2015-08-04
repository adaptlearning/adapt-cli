var chalk = require('chalk'),
    Q = require('q'),
    npm  = require('npm'),
    installCommand = invokeFactoryOrProvideObject(require('../commands/install')),
    Constants = require('../Constants'),
    path = require('path');

module.exports = function installAdaptDependencies (properties /* { renderer, localDir } */) {
    var deferred = Q.defer(),
        cwd = process.cwd();

    properties.renderer.log(chalk.cyan('installing adapt dependencies'));

    if(path.relative(cwd, properties.localDir)) {
        process.chdir(properties.localDir);
        console.log(cwd, 'change to',  process.cwd());
    }
    installCommand.install(properties.renderer, null, properties.localDir, function (err) {
        if(err) deferred.reject(err);

        process.chdir(cwd);
        deferred.resolve(properties);
    });
    return deferred.promise;
};

function invokeFactoryOrProvideObject(factoryOrObject, dependencies) {
    if(typeof factoryOrObject === 'function') return factoryOrObject(dependencies || {});
    return factoryOrObject;
}