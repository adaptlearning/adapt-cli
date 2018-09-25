// TODO
// - check promise chains

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
    // whether to target the latest compatible version for all plugin installations (overrides constraints)
    var isCompatibleEnabled = false;
    // whether adapt.json is being used to compile the list of plugins to install
    var isUsingManifest = false;

    return {
        install: function(renderer) {
            var args = [].slice.call(arguments, 1);
            var done = args.pop() || function() {};

            logger = renderer;
            
            project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
            itinerary = {};
            plugins = [];

            var dryRunArgIndex = args.indexOf('--dry-run');
            var compatibleArgIndex = args.indexOf('--compatible');

            if (dryRunArgIndex >= 0) {
                args.splice(dryRunArgIndex, 1);
                isDryRun = true;
            }

            if (compatibleArgIndex >= 0) {
                args.splice(compatibleArgIndex, 1);
                isCompatibleEnabled = true;
            }

            if (isDryRun) {
                init(args)
                .then(createPlugins)
                .then(getInitialInfo)
                .then(findCompatibleVersions)
                .then(checkConstraints)
                .then(createInstallationManifest)
                .then(summariseDryRun)
                .then(done)
                .fail(function(){console.log('Error:', arguments)});
            } else {
                init(args)
                .then(createPlugins)
                .then(getInitialInfo)
                .then(findCompatibleVersions)
                .then(checkConstraints)
                .then(createInstallationManifest)
                .then(performInstallation)
                .then(updateManifest)
                .then(summariseInstallation)
                .then(done)
                .fail(function(){console.log('Error:', arguments)});
            }
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
        isUsingManifest = true;

        itinerary = JsonLoader.readJSONSync(Constants.DefaultProjectManifestPath).dependencies;
    }

    function getItineraryFromArguments(args) {
        isUsingManifest = false;

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
            var plugin = new InstallTarget(name, itinerary[name], isCompatibleEnabled);
            plugins.push(plugin);
        });

        return Q.resolve();
    }

    function getInitialInfo() {
        //console.log('install::getInitialInfo');

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
        //console.log('install::findCompatibleVersions');

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
        //console.log('install::checkConstraints');

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
        //console.log('install::createInstallationManifest');

        var present = plugins.filter(isPresent);

        var verifiedForInstallation = present.filter(isVerifiedForInstallation);

        verifiedForInstallation.forEach(function(p) {p.markLatestCompatibleForInstallation();});
        
        // there is no compatible version, but the user requested a valid version which is not the latest (prompt for (r)equested, (l)atest or (s)kip)
        var incompatibleWithOldConstraint = present.filter(isIncompatibleWithOldConstraint);
        // there is no compatible version, but the user requested the latest version (prompt for (l)atest or (s)kip)
        var incompatibleWithLatestConstraint = present.filter(isIncompatibleWithLatestConstraint);
        // there is no compatible version, but the user requested an invalid version (prompt for (l)atest or (s)kip)
        var incompatibleWithBadConstraint = present.filter(isIncompatibleWithBadConstraint);
        // there is no compatible version and no constraint was given (prompt for (l)atest or (s)kip)
        var incompatibleWithNoConstraint = present.filter(isIncompatibleWithNoConstraint);

        // a compatible version exists but the user requested an older version that isn't compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
        var compatibleWithOldIncompatibleConstraint = present.filter(isCompatibleWithOldIncompatibleConstraint);
        // a compatible version exists but the user requested an older version that is compatible (prompt for (r)equested, (l)atest compatible or (s)kip)
        var compatibleWithOldCompatibleConstraint = present.filter(isCompatibleWithOldCompatibleConstraint);
        // a compatible version exists but the user gave a bad constraint (prompt for (c)ompatible or (s)kip)
        var compatibleWithBadConstraint = present.filter(isCompatibleWithBadConstraint);
        // a compatible version exists but user has requested a valid version that is later than the latest compatible version (prompt for (r)equested, (l)atest compatible or (s)kip)
        var compatibleWithUnmetConstraint = present.filter(isCompatibleWithUnmetConstraint);

        var allPromises = [];

        add(incompatibleWithOldConstraint, 'There is no compatible version of the following plugins:', getPrompt_incompatibleGeneric);

        add(incompatibleWithLatestConstraint, 'There is no compatible version of the following plugins:', getPrompt_incompatibleGeneric);

        add(incompatibleWithBadConstraint, 'An invalid constraint was given, but there is no compatible version of the following plugins:', getPrompt_incompatibleGeneric);

        add(incompatibleWithNoConstraint, 'There is no compatible version of the following plugins:', getPrompt_incompatibleGeneric);

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

    function updateManifest() {
        if (isUsingManifest) return Q.resolve();

        return createPromptTask({
            message: chalk.bold.yellow('<confirm>'),
            description: chalk.white('Update the manifest (adapt.json)? Please specify (y)es or (n)o.'),
            pattern: /^y$|^n$/i,
            type: 'string',
            default: 'y',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var shouldUpdate = /^y$/i.test(result);

            if (shouldUpdate) {
                Object.keys(itinerary).forEach(function(name) {
                    project.add(new Plugin(name, itinerary[name]));
                });
            }

            return Q.resolve();
        });
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

    function getPrompt_incompatibleGeneric(p) {
        return createPromptTask({
            message: chalk.bold.yellow('<confirm install>'),
            description: chalk.reset(p.packageName + ' (l)atest version or (s)kip: '),
            pattern: /^l$|^s$/i,
            type: 'string',
            default: 's',
            required: true,
            onlyRejectOnError: true,
            before: function(value) { return value; }
        })
        .then(function (result) {
            var installLatest = /^l$/i.test(result);

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
        //console.log('install::summariseInstallation');

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

    // output formatting

    function highlight(str) {
        var sub1 = 'adapt-contrib-';
        var sub2 = 'adapt-';

        if (str.indexOf(sub1) == 0) {
            return chalk.reset(sub1)+chalk.yellowBright(str.substring(sub1.length));
        }

        if (str.indexOf(sub2) == 0) {
            return chalk.reset(sub2)+chalk.yellowBright(str.substring(sub2.length));
        }

        return str;
    }

    function green(str) {
        return chalk.greenBright(str);
    }

    function greenIfEqual(v1, v2) {
        var colourFunc = semver.satisfies(v1, v2) ? chalk.greenBright : chalk.magentaBright;

        return colourFunc(v2);
    }

    function toBeInstalledPrinter(p) {
        var v_i = p._versionToInstall, v_lc = p._latestCompatibleVersion;
        
        if (v_lc == '*') {
            console.log(highlight(p.packageName), '(no version information)');
        } else {
            console.log(highlight(p.packageName), '@'+green(v_i), '(latest compatible version is '+greenIfEqual(v_i, v_lc)+')');
        }
    }

    function installSucceededPrinter(p) {
        var v_i = p._versionToInstall, v_lc = p._latestCompatibleVersion;

        if (v_lc == '*') {
            console.log(highlight(p.packageName), '(no version information)');
        } else {
            console.log(highlight(p.packageName), '@'+green(v_i), '(latest compatible version is '+greenIfEqual(v_i, v_lc)+')');
        }
    }

    function installErroredPrinter(p) {
        console.log(highlight(p.packageName), p._installError ? '(error: ' + p._installError + ')' : '(unknown error)');
    }

    function packageNamePrinter(p) {
        console.log(highlight(p.packageName));
    }

    // composite filter for when no user input is required to determine which version to install

    function isVerifiedForInstallation(p) {
        return isCompatible(p) && (!isConstrained(p) || semver.satisfies(p._resolvedConstraint, p._latestCompatibleVersion));
    }

    // composite filters for when no compatible version exists

    function isIncompatibleWithOldConstraint(p) {
        return !isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && semver.lt(semver.maxSatisfying(p._versions, p.version), p._latestVersion);
    }

    function isIncompatibleWithLatestConstraint(p) {
        return !isCompatible(p) && isConstrained(p) && isGoodConstraint(p) && semver.satisfies(semver.maxSatisfying(p._versions, p.version), p._latestVersion);
    }

    function isIncompatibleWithBadConstraint(p) {
        return !isCompatible(p) && isConstrained(p) && isBadConstraint(p);
    }

    function isIncompatibleWithNoConstraint(p) {
        return !isCompatible(p) && !isConstrained(p);
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

    function performInstallation() {
        return Q.all(plugins.filter(isToBeInstalled).map(createInstallationTask)).progress(progressUpdate).then(conclude);

        function progressUpdate() {
            var list = plugins.filter(isPresent).filter(isToBeInstalled);
            var settled = list.filter(function(p) {return isInstallSuccessful(p) || isInstallFailure(p);}).length;
            var total = list.length;
            InstallLog.logProgress(chalk.bold.cyan('<info>')+' Installing plugins '+Math.round(100*settled/total)+'% complete');
        }
        
        function conclude() {
            InstallLog.logProgressConclusion(chalk.bold.cyan('<info>')+' Installing plugins 100% complete');
            return Q.resolve();
        }
    }

    function createInstallationTask(plugin) {
        return PackageMeta.getKeywords(plugin, { registry: Constants.Registry }).then(doInstall).then(conclude);

        function doInstall(keywords) {
            var resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);

            // this lookup should probably be moved InstallTarget
            plugin._belongsTo = pluginType.belongsTo;

            return install(plugin, {
                directory: path.join('src', pluginType.belongsTo),
                registry: Constants.Registry
            });
        }
        
        function conclude(result) {
            plugin._wasInstalled = result._wasInstalled === true;
            if (result.error) plugin._installError = result.error.code;
            //renderUpdateProgress();
        }
    }
};
