var bower = require('bower'),
    chalk = require('chalk'),
    path = require('path'),
    uuid = require('uuid'),
    prompt = require('prompt'),
    Q = require('q'),
    fs = require('q-io/fs'),
    exec = require('../promise/exec'),
    npm  = require('npm'),
    RepositoryDownloader = require('../RepositoryDownloader'),
    Constants = require('../Constants'),
    PluginTypeResolver = require('../PluginTypeResolver'),
    PackageMeta = require('../PackageMeta'),
    Plugin = require('../Plugin'),
    RendererHelpers = require('../RendererHelpers'),
    installNodeDependencies = require('../promise/installNodeDependencies'),
    installAdaptDependencies = require('../promise/installAdaptDependencies');

module.exports = {
    create: function (renderer) {
        var type = arguments.length >= 3 ? arguments[1] : Constants.DefaultCreateType,
            localDir = arguments.length >= 4 ? arguments[2] : Constants.DefaultCourseName,
            branch = arguments.length >= 5 ? arguments[3] : Constants.DefaultBranch,
            done = arguments[arguments.length-1];

        confirm({
            type: type,
            localDir: localDir,
            branch: branch,
            renderer: renderer
        })
        .then(deleteExistingCourse)
        .then(function (properties) {
            renderer.write(chalk.cyan('downloading framework to', localDir, '\t'));
            return properties;
        })
        .then(getRepository)
        .progress(function (properties) {
            renderer.write(chalk.grey('.'));
            return properties;
        })
        .then(function (properties) {
            renderer.log(' ', 'done!');
            return properties;
        })
        .then(function (properties) {
            return fs.removeTree(properties.tmp)
                     .then(function () {
                        return properties;    
                     });
        })
        .then(installNodeDependencies)
        .then(installAdaptDependencies)
        .then(function (properties) {
            renderer.log('\n'+chalk.green(properties.localDir), 'has been created.\n');
            
            renderer.log(chalk.grey('To build the course, run:') + 
                '\n\tcd ' + properties.localDir + 
                '\n\tgrunt build\n');

            renderer.log(chalk.grey('Then to view the course, run:') + 
                '\n\tgrunt server\n');
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

    var schema = {
            properties: {
                type: {
                    description: 'type',
                    pattern: /^course$/,
                    type: 'string',
                    default: properties.type,
                    required: true
                },
                localDir: {
                    description: 'name',
                    pattern: /\w/,
                    type: 'string',
                    default: properties.localDir,
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
    prompt.message = chalk.cyan('Confirm');
    prompt.delimiter = ' ';
    prompt.start();
    prompt.get(schema, function (err, properties) {
        if(err) return deferred.reject(err);
        if(!properties.ready) deferred.reject(new Error('Aborted. Nothing has been created.'));

        properties.renderer = renderer;
        deferred.resolve(properties);
    });
    return deferred.promise;
}

function deleteExistingCourse(properties) {
    return fs.exists(properties.localDir)
    .then(function (exists) {
        if(exists) {
            var deferred = Q.defer();
            
            prompt.start();
            prompt.get([{
                name: 'overwrite existing course?',
                message: 'Please specify (y)es or (n)o',
                pattern: /^y$|^n$/i,
                type: 'string',
                default: 'n',
                required: true,
                before: function(value) { return /^y$/i.test(value); }
            }],
            function (err, results) {
                if(err) deferred.reject(err);

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
            });

            return deferred.promise;
        }
    })
    .then(function () {
        return properties;
    });
}

function getRepository(properties) {
    var downloader = new RepositoryDownloader({
            repository: Constants.FrameworkRepository,
            branch : properties.branch
        }),
        tmp = properties.tmp = path.join(Constants.HomeDirectory, '.adapt', 'tmp', uuid.v1()),
        downloadedSource = path.join(tmp, Constants.FrameworkRepositoryName + '-' + properties.branch);

    return downloader.fetch(tmp).then(function () {
        return fs.copyTree(downloadedSource, properties.localDir)
                 .then(function () {
                    return properties;
                 });
    });
}