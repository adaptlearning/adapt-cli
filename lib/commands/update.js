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
var VersionChecker = require('../VersionChecker')
var update = require('../promise/update');
var promise = require('../promise/util');
var readline = require('readline');

module.exports = function() {

    // # Assumptions

    // All plugins are from Adapt ecosystem ("adapt-")
    // As normal, .bowerrc will be read if present - this should point to a single Adapt registry

    // # Tasks

    // 1. Consider remove `project` and instead just store framework version

    // standard output
    var logger;
    // our temporary bower manifest
    var bowerJson;
    // a representation of the Adapt project we are going to update
    var project;
    // the plugins to update (`Plugin` instances) with the target version
    var plugins;
    // whether to summarise installed plugins without modifying anything
    var isCheck = false;
    // whether to output debugging information or not
    var isDebuggingEnabled = false;
    // when a bower command errors this is the maximum number of attempts the command will be repeated
    var bowerCmdMaxTry = 5;

    return {
        update: function(renderer) {
            var args = [].slice.call(arguments, 1);
            var done = args.pop() || function() {};

            logger = renderer;

            clean();

            bowerJson = {"name": "manifest", "dependencies":{}};
            project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
            plugins = [];
            installedPlugins = {};

            //bower.commands.info('adapt-contrib-media').on('end', function() {console.log(arguments)})

            var checkArgIndex = args.indexOf('--check');
            var debugArgIndex = args.indexOf('--debug');

            if (checkArgIndex >= 0) {
                args.splice(checkArgIndex, 1);
                isCheck = true;
            }

            if (debugArgIndex >= 0) {
                args.splice(checkArgIndex, 1);
                isDebuggingEnabled = true;
            }

            discoverPlugins();

            if (isCheck) {
                init(args)
                .then(checkRedundancy)
                .then(createPlugins)
                .then(determineTargetVersions)
                .then(printCheckSummary)
                .then(done)
                .fail(reportFailure(logger, done))
            } else {
                init(args)
                .then(checkRedundancy)
                .then(createPlugins)
                .then(determineTargetVersions)
                .then(checkMissing)
                .then(promptToUpdateIncompatible)
                .then(performUpdates)
                .then(verifyChanged)
                .then(printUpdateSummary)
                .then(done)
                .fail(reportFailure(logger, done))
                .finally(clean);
            }
        }
    }

    function discoverPlugins() {

        var components = discoverNamedGroup('components');
        var extensions = discoverNamedGroup('extensions');
        var menu = discoverNamedGroup('menu');
        var theme = discoverNamedGroup('theme');

        function discoverNamedGroup(group) {
            var srcpath = path.join('src', group);

            if (!fs.existsSync(srcpath)) return;

            var pluginNames = [];

            fs.readdirSync(srcpath).forEach(function(f) {
                var pluginPath = path.join(srcpath, f);
                var bowerPath = path.join(pluginPath, 'bower.json');
                var bowerManifest;

                if (fs.lstatSync(pluginPath).isDirectory() && fs.existsSync(bowerPath)) {
                    bowerManifest = JsonLoader.readJSONSync(bowerPath);
                    if (bowerManifest.name) {
                        installedPlugins[bowerManifest.name] = {manifest:bowerManifest, group:group};
                    }
                }
            });
        }
    }

    function addSelectedPlugins(arr) {
        var groups = ['all', 'components', 'extensions', 'menu', 'theme'];
        var selectedGroups = [];

        // record which groups are found and remove from list, taking care to avoid duplicates
        arr = arr.filter(function(item) {
            if (groups.indexOf(item) != -1) {
                if (selectedGroups.indexOf(item) == -1) selectedGroups.push(item);
                return false;
            }
            return true;
        });

        if (selectedGroups.indexOf('all') != -1) {
            addAllPlugins();
        } else {
            // add components, extensions, menus etc
            selectedGroups.forEach(addPluginsFromGroup);
            // add individual plugins
            arr.forEach(addPlugin);
        }
    }

    function getPluginNames(group) {
        return _.filter(_.keys(installedPlugins), function(k) {
            return installedPlugins[k].group == group;
        });
    }

    function addPlugin(arg) {
        var tokens = arg.split(/[#@]/);
        var name = tokens[0];
        var version = tokens[1];

        if (!installedPlugins[name]) return;

        switch (tokens.length) {
            case 1: bowerJson.dependencies[name] = '*'; break;
            case 2: bowerJson.dependencies[name] = version; break;
            default: return;
        }
    }

    function addPluginsFromGroup(group) {
        var all = !group || group == 'all';

        if (group == 'components' || all) getPluginNames('components').forEach(addPlugin);
        if (group == 'extensions' || all) getPluginNames('extensions').forEach(addPlugin);
        if (group == 'menu' || all) getPluginNames('menu').forEach(addPlugin);
        if (group == 'theme' || all) getPluginNames('theme').forEach(addPlugin);
    }

    function addAllPlugins() {
        addPluginsFromGroup();
    }

    function createManifestFromArguments(args) {
        addSelectedPlugins(args);
    }

    function init(args) {
        logger.log();

        if (args.length == 0) {
            if (isCheck) {
                args = ['all'];
                return Q(args).then(createManifestFromArguments);
            }

            return createYesNoPromptTask({
                message:chalk.bold.yellow('<confirm>'),
                description:chalk.reset('This command will attempt to update all installed plugins. Do you wish to continue? Please specify (y)es or (n)o.')
            }).then(function() {
                args = ['all'];
                return Q(args).then(createManifestFromArguments);
            });
        }
        // else process arguments
        return Q(args).then(createManifestFromArguments);
    }

    function checkRedundancy() {
        if (Object.keys(bowerJson.dependencies).length == 0) {
            return Q.reject({message:'No valid targets specified (please check spelling and case).'});
        } else {
            return Q.resolve();
        }
    }

    function createPlugins() {
        debug('createPlugins');

        Object.keys(bowerJson.dependencies).forEach(function(pluginName) {
            var plugin = Plugin.parse(pluginName+'#'+bowerJson.dependencies[pluginName]);
            plugin._installedVersion = installedPlugins[pluginName].manifest.version;
            plugin._versionIndex = 0;
            plugin._bowerCmdCount = 0;
            plugin._belongsTo = installedPlugins[pluginName].group;
            plugins.push(plugin);
        });

        var promiseToGetInfo = [];

        for (var i=0, c=plugins.length; i<c; i++) {
            promiseToGetInfo.push(getInfo(plugins[i]));
        }

        return Q.all(promiseToGetInfo).progress(function() {
                var settled = plugins.filter(function(plugin) {return plugin._bowerInfo || plugin._isMissingAtRepo;}).length;
                var total = plugins.length;
                readline.cursorTo(process.stderr, 0);
                process.stderr.write(chalk.bold.cyan('<info>')+' Querying server '+Math.round(100*settled/total)+'% complete');
            })
            .then(function() {
                process.stderr.write('\n');
            });
    }

    function determineTargetVersions() {
        //console.log('determineTargetVersions');
        return Q.all(plugins.filter(isPresent).map(getTargetVersion));
    }

    function getTargetVersion(plugin) {
        plugin._latestVersion = plugin._bowerInfo.version;
        
        // if the plugin has no tags then it is not possible to change version
        if (!plugin._versions || plugin._versions.length == 0) return Q.resolve();

        // if plugin already at latest version then nothing to do
        if (semver.satisfies(plugin._installedVersion, plugin._bowerInfo.version)) {
            //console.log('no update available for', plugin.packageName, plugin._bowerInfo.version);
            plugin._isAtLatestVersion = true;
            return Q.resolve();
        }

        //console.log('checking available updates for', plugin.packageName, 'with constraint', plugin.version, '(latest version is '+plugin._bowerInfo.version+')');
        
        return checkProposedVersion(plugin);
    }

    function checkProposedVersion(plugin, deferred) {
        deferred = deferred || Q.defer();
        var adaptVersion = project.getFrameworkVersion();
        var satisfiesConstraint = semver.satisfies(plugin._bowerInfo.version, plugin.version);

        //console.log('getting target version for', plugin.packageName, ': checking', plugin._versions[plugin._versionIndex]);

        if (!plugin._isMissingAtRepo) {
            //console.log('plugin not missing, plugin framework requirement is', plugin._bowerInfo.framework, 'installed framework', adaptVersion);
            // check that the proposed plugin is compatible with the installed framework and that it also satisfies any user-provided constraint
            if (semver.satisfies(adaptVersion, plugin._bowerInfo.framework) &&
                satisfiesConstraint) {
                //console.log(plugin.packageName, chalk.green('can'), 'be updated from', plugin._installedVersion, 'to', plugin._bowerInfo.version, '(requires framework '+plugin._bowerInfo.framework+')');
                plugin._proposedVersion = plugin._bowerInfo.version;
                plugin._shouldBeUpdated = true;
                deferred.resolve();
            } else {
                //console.log(plugin.packageName, chalk.red('cannot'), 'be updated to', plugin._bowerInfo.version, '(requires framework'+plugin._bowerInfo.framework+')');
                if (plugin._versionIndex + 1 < plugin._versions.length && semver.gt(plugin._versions[plugin._versionIndex + 1], plugin._installedVersion)) {
                    plugin._versionIndex++;
                    getInfo(plugin).then(function() {
                        checkProposedVersion(plugin, deferred);
                    });
                } else {
                    deferred.resolve();
                }
            }
        } else {
            deferred.resolve();
        }

        return deferred.promise;
    }

    function getInfo(plugin, deferred) {
        // presence of deferred signifies a retry
        if (!deferred) this._bowerCmdCount = 0;
        
        deferred = deferred || Q.defer();

        function onSuccess(results) {
            plugin._bowerInfo = results.latest || results;
            if (results.versions) plugin._versions = results.versions;
            deferred.notify();
            deferred.resolve(results);
        }

        function onFail() {
            reportError();

            if (canRetry()) {
                getInfo(plugin, deferred);
            } else {
                plugin._isMissingAtRepo = true;
                deferred.notify();
                deferred.resolve();
            }
        }

        try {
            //console.log('Querying registry for', plugin.packageName, '(' + plugin.version + ')');
            var versionString = plugin._versions ? '#'+plugin._versions[plugin._versionIndex] : '';
            plugin._bowerCmdCount++;
            bower.commands.info(plugin.packageName+versionString).on('end', onSuccess).on('error', onFail);
        } catch(err) {
            onFail();
        }

        function canRetry() {
            return plugin._bowerCmdCount < bowerCmdMaxTry;
        }

        function reportError() {
            if (plugin._bowerCmdCount < bowerCmdMaxTry) {
                debug(chalk.bold.magenta('<debug>'), 'Could not get info for', plugin.packageName+'.', 'Retrying.');
            } else {
                debug(chalk.bold.magenta('<debug>'), 'Could not get info for', plugin.packageName+'.', 'Aborting.');
            }
        }

        return deferred.promise;
    }

    function checkMissing() {
        var missing = plugins.filter(isMissing);

        if (missing.length == 0) {
            return Q.resolve();
        } else if (missing.length == plugins.length) {
            if (missing.length == 1) {
                return Q.reject('The requested plugin was not found at the registry');
            } else {
                return Q.reject('None of the requested plugins were found at the registry');
            }
        } else {
            return promptToListMissing().then(listMissingAndPromptToContinue);
        }
    }

    function promptToListMissing() {
       return createPromptTask({
            description: chalk.cyan('Some plugins could not be found at the registry. Hit <Enter> for list.'),
        });
    }

    function listMissingAndPromptToContinue() {
        var missing = plugins.filter(isMissing);

        missing.forEach(function(plugin) {
            logger.log(plugin.packageName);
        });

        return createPromptTask({
            description: chalk.cyan('Continue to update other plugins? Please specify (y)es or (n)o.'),
            pattern: /^y$|^n$/i,
            type: 'string',
            default: 'y',
            required: true,
            before: function(value) { return /^y$/i.test(value); }
        });
    }

    function isMissing(plugin) {
        return plugin._isMissingAtRepo === true;
    }

    function isPresent(plugin) {
        return !isMissing(plugin);
    }

    function isIncompatible(plugin) {
        return !semver.valid(plugin._proposedVersion);
    }

    function isToBeUpdated(plugin) {
        return plugin._shouldBeUpdated && !plugin._wasUpdated;
    }

    function isConstrained(plugin) {
        return plugin.version != '*';
    }

    function isUntagged(plugin) {
        return !plugin._versions || plugin._versions.length == 0;
    }

    function someOtherVersionSatisfiesConstraint(plugin) {
        var maxSatisfying = semver.maxSatisfying(plugin._versions, plugin.version);
        return maxSatisfying != null && !semver.satisfies(maxSatisfying, plugin._installedVersion);
    }

    function promptToUpdateIncompatible() {
        //console.log('promptToUpdateIncompatible');
        var adaptVersion = project.getFrameworkVersion();
        // if there are no compatible updates but the user has requested a specific version (or range) and a corresponding version exists then prompt
        var list = plugins.filter(isPresent).filter(isIncompatible).filter(isConstrained).filter(someOtherVersionSatisfiesConstraint);

        if (list.length == 0) return Q.resolve();

        logger.log(chalk.bgRed('<warning>'), ' Changes to the following plugins have been requested that will not use the latest compatible version in each case.');

        return promise.serialise(list, function(plugin) {
            // only prompt for plugins that have been requsted with a specific version constraint by the user
            return createPromptTask({
                message: chalk.bold.yellow('<confirm>'),
                description: chalk.reset('Change ' + plugin.packageName + ' to ' + semver.maxSatisfying(plugin._versions, plugin.version) + '? Please specify (y)es or (n)o'),
                pattern: /^y$|^n$/i,
                type: 'string',
                default: 'n',
                required: true,
                onlyRejectOnError: true,
                before: function(value) { return /^y$/i.test(value); }
            })
            .then(function(result) {
                plugin._shouldBeUpdated = result;
            });
        });
    }

    function performUpdates() {
        var filtered = plugins.filter(isPresent).filter(isToBeUpdated);
        var settled = 0, total = filtered.length;

        return promise.serialise(filtered, function(plugin) {
            return createUpdateTask(plugin);
        })
        .then(function() {
            renderUpdateProgressFinished();
        });
    }

    function verifyChanged() {
        plugins.filter(isPresent).forEach(function(plugin) {
            if (!plugin._wasUpdated) return;

            var p = path.join('src', plugin._belongsTo, plugin.packageName, 'bower.json');
            var j = JsonLoader.readJSONSync(p);

            plugin._updatedVersion = j.version;
        });

        return Q.resolve();
    }

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

    function yellowIfEqual(v1, v2) {
        var colourFunc = semver.satisfies(v1, v2) ? chalk.yellowBright : chalk.magentaBright;

        return colourFunc(v2);
    }

    function greenIfEqual(v1, v2) {
        var colourFunc = semver.satisfies(v1, v2) ? chalk.greenBright : chalk.magentaBright;

        return colourFunc(v2);
    }

    function printCheckSummary() {
        //console.log('printCheckSummary');

        var present = plugins.filter(isPresent);
        var missing = plugins.filter(isMissing);
        var untagged = _.difference(present.filter(isUntagged), isMissing);
        var latest = present.filter(function(plugin) {return plugin._isAtLatestVersion});
        var updateAvailable = present.filter(function(plugin){return plugin._proposedVersion});
        var updateNotAvailable = _.difference(present.filter(function(plugin){return !plugin._proposedVersion}), missing, untagged, latest);

        var byPackageName = function(a, b) {
            if (a.packageName < b.packageName) return -1;
            if (a.packageName > b.packageName) return 1;
            return 0;
        };

        logger.log();

        if (latest.length > 0) logger.log(chalk.whiteBright('The following plugins are using the latest version:'));

        latest.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)));
        });

        if (latest.length > 0) logger.log();

        // ************************************

        if (updateAvailable.length > 0) logger.log(chalk.whiteBright('The following updates can be made:'));

        updateAvailable.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._proposedVersion), '(latest is '+greenIfEqual(plugin._proposedVersion, plugin._latestVersion)+')'));
        });

        if (updateAvailable.length > 0) logger.log();

        // ************************************

        if (updateNotAvailable.length > 0) logger.log(chalk.whiteBright('The following have no compatible updates:'));

        updateNotAvailable.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)+' (latest is '+chalk.magentaBright(plugin._latestVersion)+')'));
        });

        if (updateNotAvailable.length > 0) logger.log();

        // ************************************

        untagged.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.redBright(plugin.packageName, 'has no version tags and so cannot be updated'));
        });

        if (untagged.length > 0) logger.log();

        // ************************************

        missing.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.redBright(plugin.packageName, 'could not be found at the registry'));
        });

        if (missing.length > 0) logger.log();
    }

    function printUpdateSummary() {
        logger.log(chalk.bold.cyan('<info>'), 'Operation completed. Update summary:');

        var present = plugins.filter(isPresent);
        var missing = plugins.filter(isMissing);
        var untagged = _.difference(present.filter(isUntagged), isMissing);
        var errored = present.filter(function(plugin) {return plugin._shouldBeUpdated && !plugin._wasUpdated});
        var updated = present.filter(function(plugin) {return plugin._wasUpdated});
        var latest = present.filter(function(plugin) {return plugin._isAtLatestVersion});
        var userSkipped = _.difference(present.filter(isConstrained).filter(isIncompatible).filter(someOtherVersionSatisfiesConstraint), updated, errored);
        var incompatibleConstrained = _.difference(present.filter(isIncompatible).filter(isConstrained), updated, untagged);
        var incompatible = _.difference(present.filter(isIncompatible), missing, untagged, latest, updated, incompatibleConstrained);

        var byPackageName = function(a, b) {
            if (a.packageName < b.packageName) return -1;
            if (a.packageName > b.packageName) return 1;
            return 0;
        };

        logger.log();

        if (latest.length > 0) logger.log(chalk.whiteBright('The following plugins are using the latest version:'));

        latest.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)));
        });

        if (latest.length > 0) logger.log();

        //***************************

        if (incompatibleConstrained.length > 0) logger.log(chalk.whiteBright('The following plugins are using the requested version:'));

        incompatibleConstrained.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)) + '. Latest is', chalk.magentaBright(plugin._latestVersion));
        });

        if (incompatibleConstrained.length > 0) logger.log();

        //***************************

        if (incompatible.length > 0) logger.log(chalk.whiteBright('The following plugins are using the latest compatible version:'));

        incompatible.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)) + '. Latest is', greenIfEqual(plugin._installedVersion, plugin._latestVersion));
        });

        if (incompatible.length > 0) logger.log();

        //***************************

        if (updated.length > 0) logger.log(chalk.whiteBright('The following updates have been made:'));

        updated.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName)), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._updatedVersion)+'.', 'Latest is', greenIfEqual(plugin._updatedVersion, plugin._latestVersion));
        });

        if (updated.length > 0) logger.log();

        //***************************

        userSkipped.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.magenta(plugin.packageName, 'was skipped'));
        });

        if (userSkipped.length > 0) logger.log();

        errored.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.bold.redBright(plugin.packageName, 'could not be updated', '(error code '+plugin._updateError+')'));
        });

        if (errored.length > 0) logger.log();

        untagged.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.redBright(plugin.packageName, 'has no version tags and so cannot be updated'));
        });

        if (untagged.length > 0) logger.log();

        missing.sort(byPackageName).sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.redBright(plugin.packageName, 'could not be found at the registry'));
        });

        return Q.resolve();
    }

    function clean() {
        if (fs.existsSync('bower.json')) {
            fs.unlinkSync('bower.json');
        }
        return Q.resolve();
    }

    function createUpdateTask(plugin) {
        //console.log(plugin.packageName, 'is missing', !!plugin._isMissingAtRepo, 'is ignored',!plugin._shouldBeUpdated);

        return Q.when(null, function() {
                var deps = {};
                var manifest;

                // create bower.json with a single dependency, otherwise bower will install things incorrectly
                deps[plugin.packageName] = plugin._proposedVersion || plugin.version;
                manifest = _.extend({}, bowerJson, {dependencies:deps});
                
                //console.log('manifest\n', JSON.stringify(manifest, null, 4));
                JsonWriter.writeJSONSync('bower.json', manifest);
                //console.log(JSON.stringify(JsonLoader.readJSONSync('bower.json'), null, 4));
                return update(plugin, null, {
                    directory: path.join('src', plugin._belongsTo),
                    registry: Constants.Registry,
                    force:true
                })
                .then(function (result) {
                    //console.log(result.updated, result.error ? 'error code: '+result.error.code : 'no error')
                    plugin._wasUpdated = result.updated;
                    if (result.error) plugin._updateError = result.error.code;
                    renderUpdateProgress();
                });
            })
            
    }

    function createYesNoPromptTask(params) {
        return createPromptTask(_.extend({}, {
                description:'Do you wish to continue? Please specify (y)es or (n)o.',
                pattern: /^y$|^n$/i,
                type: 'string',
                default: 'y',
                required: true,
                before: function(value) { return /^y$/i.test(value); }
            }, params));
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

    function renderUpdateProgress() {
        var list = plugins.filter(function(plugin) {return !plugin._isMissingAtRepo && plugin._shouldBeUpdated});
        var settled = plugins.filter(function(plugin) {return _.isBoolean(plugin._wasUpdated);}).length;
        var total = list.length;
        //console.log('progress', settled, total);
        readline.cursorTo(process.stderr, 0);
        process.stderr.write(chalk.bold.cyan('<info>')+' Updates '+Math.round(100*settled/total)+'% complete');
    }

    function renderUpdateProgressFinished() {
        process.stderr.write('\n');
    }

    function debug() {
        if (isDebuggingEnabled) {
            logger.debug.apply(logger, arguments);
        }
    }

    function reportFailure(renderer, done) {
        return function (err) {
            renderer.log(chalk.redBright(err.message));
            done(err);
        };
    }
};
