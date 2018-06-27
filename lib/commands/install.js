// TODO
// - check promise chains
// - consider adapt.json - modify?

var bower = require('bower');
var chalk = require('chalk');
var fs = require('fs');
var _ = require('lodash')
var path = require('path');
var prompt = require('prompt')
var Q = require('q');
var semver = require('semver');
var Constants = require('../Constants');
var JsonLoader = require('../JsonLoader');
var JsonWriter = require('../JsonWriter');
var PackageMeta = require('../PackageMeta');
var Plugin = require('../Plugin');
var Project = require('../Project');
var PluginTypeResolver = require('../PluginTypeResolver');
var RendererHelpers = require('../RendererHelpers');
var install = require('../promise/install');
var promise = require('../promise/util');
var InstallTarget = require('./install/InstallTarget');
var InstallLog = require('./install/InstallLog');

module.exports = function (dependencies) {

    // standard output
    var logger;
    // a representation of the target Adapt project
    var project;
    // a list of plugin name/version pairs 
    var itinerary;
    // the plugins to install (`Plugin` instances)
    var plugins;
    // whether to summarise installation without modifying anything
    var isDryRun = false;

    return {
        install: function(renderer) {
            var args = [].slice.call(arguments, 1);
            var done = args.pop() || function() {};

            logger = renderer;
            
            project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
            itinerary = {};
            plugins = [];

            var dryRunArgIndex = args.indexOf('--dry-run');

            if (dryRunArgIndex >= 0) {
                args.splice(dryRunArgIndex, 1);
                isDryRun = true;
            }

            if (isDryRun) {
                init(args)
                .then(createPlugins)
                .then(getInitialInfo)
                .then(findCompatibleVersions)
                .then(checkConstraints)
                .then(createInstallationManifest)
                .then(summariseDryRun)
                .then(function(){return Q(null).done();})
                .fail(function(){console.log('Error:', arguments)});
            } else {
                init(args)
                .then(createPlugins)
                .then(getInitialInfo)
                .then(findCompatibleVersions)
                .then(checkConstraints)
                .then(createInstallationManifest)
                .then(performInstallation)
                .then(summariseInstallation)
                .then(function(){return Q(null).done();})
                .fail(function(){console.log('Error:', arguments)});
            }
        },

        oldinstall: function (renderer) {
            var packageName = arguments.length >= 3 ? arguments[1] : null,
                done = arguments[arguments.length-1] || function () {};

            var project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath),
                plugins = packageName ? [Plugin.parse(packageName)] : project.plugins;

            var versionChecks = plugins.map(function (plugin) {
                return checkVersionCompatibilityTask(plugin, project);
            });

            Q.all(versionChecks)
             .then(function (checkedPlugins) {
                return getSequenceOfUserConfirmationTasks(checkedPlugins, renderer);
             })
             .then(function (confirmedPlugins) {
                var installations = confirmedPlugins.filter(function (result) {
                        return result.continueWithInstall === true;
                    })
                    .map(function (result) {
                        project.add(result.plugin);
                        return createInstallationTask(result.plugin, renderer);
                    });
                return Q.all(installations);
            })
            .then(function (){
                done(null);
            })
            .fail(RendererHelpers.reportFailure(renderer, done));
        }
    };

    function init(args) {
        if (args.length == 0) {
            getItineraryFromManifest();
        } else {
            getItineraryFromArguments(args);
        }

        return Q.resolve();
    }

    function getItineraryFromManifest() {

        itinerary = JsonLoader.readJSONSync(Constants.DefaultProjectManifestPath).dependencies;
    }

    function getItineraryFromArguments(args) {
        args.forEach(function(arg) {
            var tokens = arg.split(/[#@]/);
            var name = tokens[0];
            var version = tokens[1];

            switch (tokens.length) {
                case 1: itinerary[name] = '*'; break;
                case 2: itinerary[name] = version; break;
                default: return;
            }
        });
    }

    function createPlugins() {
        Object.keys(itinerary).forEach(function(name) {
            var plugin = new InstallTarget(name, itinerary[name]);
            plugins.push(plugin);
        });

        return Q.resolve();
    }

    function getInitialInfo() {
        console.log('install::getInitialInfo');

        var promises = [];

        for (var i=0, c=plugins.length; i<c; i++) {
            promises.push(plugins[i].getInitialInfo());
        }

        return Q.all(promises).progress(progressUpdate).then(conclude);

        function progressUpdate() {
            var settled = plugins.filter(function(plugin) {return plugin._rawInfo || plugin._isMissingAtRepo;}).length;
            var total = plugins.length;
            InstallLog.logProgress(chalk.bold.cyan('<info>')+' Getting plugin info '+Math.round(100*settled/total)+'% complete');
        }
        
        function conclude() {
            InstallLog.logProgressConclusion(chalk.bold.cyan('<info>')+' Getting plugin info 100% complete');
            return Q.resolve();
        }
    }

    function findCompatibleVersions() {
        console.log('install::findCompatibleVersions');

        var promises = [];
        var present = plugins.filter(isPresent);

        for (var i=0, c=present.length; i<c; i++) {
            promises.push(present[i].findCompatibleVersion(project.getFrameworkVersion()));
        }
        
        return Q.all(promises).progress(progressUpdate).then(conclude);

        function progressUpdate() {
            var settled = present.filter(function(plugin) {return plugin._latestCompatibleVersion != undefined;}).length;
            var total = present.length;
            InstallLog.logProgress(chalk.bold.cyan('<info>')+' Finding compatible versions '+Math.round(100*settled/total)+'% complete');
        }
        
        function conclude() {
            InstallLog.logProgressConclusion(chalk.bold.cyan('<info>')+' Finding compatible versions 100% complete');
            return Q.resolve();
        }
    }

    function checkConstraints() {
        console.log('install::checkConstraints');

        var promises = [];
        var present = plugins.filter(isPresent);

        for (var i=0, c=present.length; i<c; i++) {
            promises.push(present[i].checkConstraint(project.getFrameworkVersion()));
        }
        
        return Q.all(promises).progress(progressUpdate).then(conclude);

        function progressUpdate() {
            var settled = present.filter(function(plugin) {return plugin._constraintChecked != undefined;}).length;
            var total = present.length;
            InstallLog.logProgress(chalk.bold.cyan('<info>')+' Checking constraints '+Math.round(100*settled/total)+'% complete');
        }
        
        function conclude() {
            InstallLog.logProgressConclusion(chalk.bold.cyan('<info>')+' Checking constraints 100% complete');
            return Q.resolve();
        }
    }

    function createInstallationManifest() {
        console.log('install::createInstallationManifest');

        var present = plugins.filter(isPresent);

        var verifiedForInstallation = present.filter(isVerifiedForInstallation);

        verifiedForInstallation.forEach(function(p) {p.markLatestCompatibleForInstallation();});
        
        // there is no compatible version, but the user requested a valid version which is not the latest (prompt for (r)equested, (l)atest or (s)kip)
        var incompatibleWithOldConstraint = present.filter(isIncompatibleWithOldConstraint);
        // there is no compatible version, but the user requested the latest version (prompt for (l)atest or (s)kip)
        var incompatibleWithLatestConstraint;
        // there is no compatible version, but the user requested an invalid version (prompt for (l)atest or (s)kip)
        var incompatibleWithBadConstraint;
        // there is no compatible version and no constraint was given (prompt for (l)atest or (s)kip)
        var incompatibleWithNoConstraint;

        // a compatible version exists but the user requested an older version that isn't compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
        var compatibleWithOldIncompatibleConstraint = present.filter(isCompatibleWithOldIncompatibleConstraint);
        // a compatible version exists but the user requested an older version that is compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
        var compatibleWithOldCompatibleConstraint = present.filter(isCompatibleWithOldCompatibleConstraint);
        // a compatible version exists but the user gave a bad constraint (prompt for (c)ompatible or (s)kip)
        var compatibleWithBadConstraint = present.filter(isCompatibleWithBadConstraint);
        // a compatible version exists but user has requested a valid version that is later than the latest compatible version (prompt for (r)equested, (l)atest compatible or (s)kip)
        var compatibleWithUnmetConstraint = present.filter(isCompatibleWithUnmetConstraint);

        var allPromises = [];

        add(incompatibleWithOldConstraint, 'There is no compatible version of the following plugins:', getPrompt_incompatibleWithOldConstraint);

        add(compatibleWithOldIncompatibleConstraint, 'An older incompatible version has been requested for the following plugins:', getPrompt_compatibleWithOldIncompatibleConstraint);

        add(compatibleWithOldCompatibleConstraint, 'A compatible but older version has been requested for the following plugins:', getPrompt_compatibleWithOldCompatibleConstraint);
        
        add(compatibleWithBadConstraint, 'An invalid constraint was given but a compatible version exists for the following plugins:', getPrompt_compatibleWithBadConstraint);

        add(compatibleWithUnmetConstraint, 'The requested version is incompatible but a compatible version exists for the following plugins:', getPrompt_compatibleWithUnmetConstraint);

        if (allPromises.length == 0) return Q.resolve();

        return promise.serialise(allPromises, execute);

        function add(list, header, prompt) {
            if (list.length > 0) {
                allPromises.push({
                    header: chalk.cyan('<info> ') + header,
                    list: list,
                    prompt: prompt
                });
            }
        }

        function execute(obj) {
            console.log(obj.header);
            return promise.serialise(obj.list, obj.prompt);
        }
    }

    function getPrompt_incompatibleWithOldConstraint(p) {
        return createPromptTask({
            message: chalk.bold.yellow('<confirm install>'),
            description: chalk.reset(p.packageName + ' (r)equested version, (l)atest version or (s)kip: '),
            pattern: /^r$|^l$|^s$/i,
            type: 'string',
            default: 's',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var installRequested = /^r$/i.test(result);
            var installLatest = /^l$/i.test(result);

            if (installRequested) p.markRequestedForInstallation();
            if (installLatest) p.markLatestForInstallation();

            return Q.resolve();
        });
    }

    function getPrompt_compatibleWithOldIncompatibleConstraint(p) {
        var str = p.packageName +
                ' ' +chalk.yellowBright('(r)')+'equested version [' + semver.maxSatisfying(p._versions, p.version) + ']' +
                ', '+chalk.yellowBright('(l)')+'atest compatible version [' + p._latestCompatibleVersion + ']' +
                ' or '+chalk.yellowBright('(s)')+'kip:';

        return createPromptTask({
            message: chalk.bold.yellow('<confirm install>'),
            description: chalk.white(str),
            pattern: /^r$|^l$|^s$/i,
            type: 'string',
            default: 's',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var installRequested = /^r$/i.test(result);
            var installLatestCompatible = /^l$/i.test(result);

            if (installRequested) p.markRequestedForInstallation();
            if (installLatestCompatible) p.markLatestCompatibleForInstallation();

            return Q.resolve();
        });
    }

    function getPrompt_compatibleWithOldCompatibleConstraint(p) {
        var str = p.packageName +
                ' ' +chalk.yellowBright('(r)')+'equested version [' + p._resolvedConstraint + ']' +
                ', '+chalk.yellowBright('(l)')+'atest compatible version [' + p._latestCompatibleVersion + ']' +
                ' or '+chalk.yellowBright('(s)')+'kip:';

        return createPromptTask({
            message: chalk.bold.yellow('<confirm install>'),
            description: chalk.white(str),
            pattern: /^r$|^l$|^s$/i,
            type: 'string',
            default: 's',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var installRequested = /^r$/i.test(result);
            var installLatestCompatible = /^l$/i.test(result);

            if (installRequested) p.markRequestedForInstallation();
            if (installLatestCompatible) p.markLatestCompatibleForInstallation();

            return Q.resolve();
        });
    }

    function getPrompt_compatibleWithBadConstraint(p) {
        var str = p.packageName +
                ' '+chalk.yellowBright('(c)')+'ompatible version [' + p._latestCompatibleVersion + ']' +
                ' or '+chalk.yellowBright('(s)')+'kip:';

        return createPromptTask({
            message: chalk.bold.yellow('<confirm install>'),
            description: chalk.white(str),
            pattern: /^c$|^s$/i,
            type: 'string',
            default: 's',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var installLatestCompatible = /^c$/i.test(result);

            if (installLatestCompatible) p.markLatestCompatibleForInstallation();

            return Q.resolve();
        });
    }

    function getPrompt_compatibleWithUnmetConstraint(p) {
        var str = p.packageName +
                ' ' +chalk.yellowBright('(r)')+'equested version [' + semver.maxSatisfying(p._versions, p.version) + ']' +
                ', '+chalk.yellowBright('(l)')+'atest compatible version [' + p._latestCompatibleVersion + ']' +
                ' or '+chalk.yellowBright('(s)')+'kip:';

        return createPromptTask({
            message: chalk.bold.yellow('<confirm install>'),
            description: chalk.white(str),
            pattern: /^r$|^l$|^s$/i,
            type: 'string',
            default: 's',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var installRequested = /^r$/i.test(result);
            var installLatestCompatible = /^l$/i.test(result);

            if (installRequested) p.markRequestedForInstallation();
            if (installLatestCompatible) p.markLatestCompatibleForInstallation();

            return Q.resolve();
        });
    }

    function summariseDryRun() {
        var toBeInstalled = plugins.filter(isToBeInstalled);
        var toBeSkipped = plugins.filter(isSkipped);
        var missing = plugins.filter(isMissing);

        summarise(toBeInstalled, toBeInstalledPrinter, 'The following plugins will be installed:');
        summarise(toBeSkipped, packageNamePrinter, 'The following plugins will be skipped:');
        summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:');

        function summarise(list, iterator, header) {
            if (!list || !iterator || list.length == 0) return;

            console.log(chalk.cyanBright(header));
            list.forEach(iterator);
        }

        return Q.resolve();
    }

    function summariseInstallation() {
        var installSucceeded = plugins.filter(isInstallSuccessful);
        var installSkipped = plugins.filter(isSkipped);
        var installErrored = plugins.filter(isInstallFailure);
        var missing = plugins.filter(isMissing);

        var allSuccess = 'All requested plugins were successfully installed. Summary of installation:';
        var someSuccess = 'The following plugins were successfully installed:';
        var noSuccess = 'None of the requested plugins could be installed';
        var successMsg;

        if (installErrored.length == 0 && missing.length == 0) successMsg = allSuccess;
        else if (installSucceeded.length == 0) successMsg = noSuccess;
        else successMsg = someSuccess;

        summarise(installSucceeded, installSucceededPrinter, successMsg);
        summarise(installSkipped, packageNamePrinter, 'The following plugins were skipped:');
        summarise(installErrored, installErroredPrinter, 'The following plugins could not be installed:');
        summarise(missing, packageNamePrinter, 'There was a problem locating the following plugins:');

        function summarise(list, iterator, header) {
            if (!list || !iterator || list.length == 0) return;

            console.log(chalk.cyanBright(header));
            list.forEach(iterator);
        }

        return Q.resolve();
    }

    function isToBeInstalled(p) {
        return p._versionToInstall != undefined;
    }

    function isInstallSuccessful(p) {
        return p._versionToInstall != undefined && p._wasInstalled === true;
    }

    function isInstallFailure(p) {
        return p._versionToInstall != undefined && p._wasInstalled === false;
    }

    function isSkipped(p) {
        return !p._isMissingAtRepo && p._versionToInstall == undefined;
    }

    function toBeInstalledPrinter(p) {
        console.log(p.packageName, '@'+p._versionToInstall+' (latest compatible version is '+p._latestCompatibleVersion+')');
    }

    function installSucceededPrinter(p) {
        console.log(p.packageName, '@'+p._versionToInstall+' (latest compatible version is '+p._latestCompatibleVersion+')');
    }

    function installErroredPrinter(p) {
        console.log(p.packageName, p._installError ? '(error: ' + p._installError + ')' : '(unknown error)');
    }

    function packageNamePrinter(p) {
        console.log(p.packageName);
    }

    // composite filter for when no user input is required to determine which version to install

    function isVerifiedForInstallation(p) {
        return isCompatible(p) && (!isConstrained(p) || semver.satisfies(p._resolvedConstraint, p._latestCompatibleVersion));
    }

    // composite filters for when no compatible version exists

    function isIncompatibleWithOldConstraint(p) {
        return !isCompatible(p) && isGoodConstraint(p) && semver.lt(semver.maxSatisfying(p._versions, p.version), p._latestVersion);
    }

    // composite filters for when a compatible version exists

    function isCompatibleWithOldCompatibleConstraint(p) {
        return isCompatible(p) && isConstraintCompatible(p) && semver.lt(p._resolvedConstraint, p._latestCompatibleVersion);
    }

    function isCompatibleWithBadConstraint(p) {
        return isCompatible(p) && isBadConstraint(p);
    }

    function isCompatibleWithOldIncompatibleConstraint(p) {
        // when the following elements of the filter are true they imply:
        //
        // isCompatible(p) - there exists a compatible version
        // isConstrained(p) - a constraint was given (i.e. not a wildcard '*')
        // isGoodConstraint(p) - the constraint resolved to a version of the plugin
        // !isConstraintCompatible(p) - the constraint did not resolve to a compatible version
        //
        // the last element determines if the constraint only specified version(s) less than the latest compatible version
        return isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && !isConstraintCompatible(p) && semver.lt(semver.maxSatisfying(p._versions, p.version), p._latestCompatibleVersion);
    }

    function isCompatibleWithUnmetConstraint(p) {
        // when the following elements of the filter are true they imply:
        //
        // isCompatible(p) - there exists a compatible version
        // isConstrained(p) - a constraint was given (i.e. not a wildcard '*')
        // isGoodConstraint(p) - the constraint resolved to a version of the plugin
        // !isConstraintCompatible(p) - the constraint did not resolve to a compatible version
        //
        // the last element determines if the constraint specified version(s) greater than the latest compatible version
        return isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && !isConstraintCompatible(p) && semver.gt(semver.maxSatisfying(p._versions, p.version), p._latestCompatibleVersion);
    }

    // simple filters

    function isConstraintCompatible(p) {
        return p._resolvedConstraint != undefined && p._resolvedConstraint != null;
    }

    function isCompatible(p) {
        return p._latestCompatibleVersion != undefined && p._latestCompatibleVersion != null;
    }

    function isConstrained(plugin) {
        return plugin.version != '*';
    }

    function isGoodConstraint(plugin) {
        return plugin._isBadConstraint === false;
    }

    function isBadConstraint(plugin) {
        return plugin._isBadConstraint === true;
    }

    function isMissing(plugin) {
        return plugin._isMissingAtRepo === true;
    }

    function isPresent(plugin) {
        return !isMissing(plugin);
    }

    function createPromptTask(params) {
        var deferred = Q.defer();
        var defaultConfig = {
            description: chalk.cyan('Hit <Enter> to continue'),
            onlyRejectOnError: false,
            before:function(){return true;}
        };
        var config = _.extend({}, defaultConfig, params);
        var schema = {properties: {question: config}};
        prompt.message = params.message || '';
        prompt.delimiter = ' ';
        prompt.start();
        prompt.get(schema, function (err, confirmation) {
            if (err) return deferred.reject(err);
            if (!config.onlyRejectOnError && !confirmation.question) deferred.reject(new Error('Aborted. Nothing has been updated.'));
            deferred.resolve(confirmation.question);
        });
        return deferred.promise;
    }

    /*function checkVersionCompatibilityTask(plugin, project) {
         // go to bower repo for given plugin and look in bower.json for "framework":"x.x.x" value (n1)
         // read local Adapt package.json to get version of framework (n2)
         // determine if n1 satisfies n2
         // N.B. satisfication fails if n1 is * or >=0.0.0 and n2 is >=2.0.0
         return PackageMeta.getFrameworkCompatibility(plugin)
                           .then(function (versionRange) {
                               return {
                                   plugin: plugin,
                                   isCompatible: VersionChecker.assertVersionCompatibility(project.getFrameworkVersion(), versionRange)
                               };
                           });
    }

    function getSequenceOfUserConfirmationTasks(checkedPlugins, renderer) {
        return promise.serialise(checkedPlugins, function (result) {
            if (!result.isCompatible) {
                return RendererHelpers.reportCompatibilityWarning(renderer, result.plugin);
            }

            result.continueWithInstall = true;
            return Q(result);
        });
    }

    function createInstallationTask(plugin, renderer) {
        return PackageMeta.getKeywords(plugin, { registry: Constants.Registry })
                          .then(function (keywords) {
                              var resolver = new PluginTypeResolver(),
                                  pluginType = resolver.resolve(keywords);

                              renderer.log(chalk.cyan(plugin.packageName), 'found.', 'Installing', pluginType.typename, '...');
                              return install(plugin, {
                                  directory: path.join('src', pluginType.belongsTo),
                                  registry: Constants.Registry
                              });
                          })
                          .then(function (installed) {
                              if (!installed) throw new Error('The plugin was found but failed to download and install.');
                              renderer.log(chalk.green(plugin.packageName), 'has been installed successfully.');
                          });
    }*/

    function performInstallation() {
        return Q.all(plugins.filter(isToBeInstalled).map(createInstallationTask));
    }

    function createInstallationTask(plugin) {
        console.log(typeof plugin.packageName);
        console.log(typeof plugin.version);
        console.log(plugin.toString());
        return PackageMeta.getKeywords(plugin, { registry: Constants.Registry }).then(doInstall).then(conclude);

        function doInstall(keywords) {
            var resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);
            return install(plugin, {save:false}, {
                directory: path.join('src', pluginType.belongsTo),
                registry: Constants.Registry
            });
        }
        
        function conclude(result) {
            plugin._wasInstalled = result._wasInstalled;
            if (result.error) plugin._installError = result.error.code;
            //renderUpdateProgress();
        }
    }
};