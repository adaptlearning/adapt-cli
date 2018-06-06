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

    // # Usage

    // update according to adapt.json:
    //   $ update
    // update selected plugin groups (components/extensions/menu/theme/all):
    //   $ update <group> [<group> ..]
    // update selected plugins:
    //   $ update <pluginName> [<pluginName> ..]
    // update a combination of groups/plugins:
    //   $ update <target> [<target> ..]

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
    // whether the Adapt manifest will determine how to update the plugins
    var useAdaptJson = false;

    var checkOnly = false;

    return {
        update: function(renderer) {
            var args = [].slice.call(arguments, 1);
            var done = args.pop() || function() {};

            logger = renderer;
            //bowerExists = fs.existsSync('bower.json');

            // cleanup any errant temporary manifest
            /*if (bowerExists && JsonLoader.readJSONSync('bower.json')._managedByAdaptCli) {
                bowerExists = false;*/
                clean();
            //}

            bowerJson = /*bowerExists ? JsonLoader.readJSONSync('bower.json') :*/ {"name":"temporary-manifest", "_managedByAdaptCli":true, "dependencies":{}};
            project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
            plugins = [];
            installedPlugins = {};

            //console.log(args);

            //console.log('gte', semver.satisfies('3.0.0', '>=3'));
            //bower.commands.info('adapt-contrib-media').on('end', function() {console.log(arguments)})

            var checkArgIndex = args.indexOf('--check');

            discoverPlugins();

            if (checkArgIndex != -1) {
                checkOnly = true;
                args.splice(checkArgIndex, 1);
                init(args)
                .then(checkRedundancy)
                .then(createPlugins)
                //.then(resolveTypes)
                .then(noteInstalledVersions)
                .then(determineTargetVersions)
                .then(printDryRunSummary)
                .then(function(){return Q(null).done();})
                .fail(RendererHelpers.reportFailure(logger, done))
            } else {
                init(args)
                .then(checkRedundancy)
                .then(createPlugins)
                //.then(resolveTypes)
                .then(noteInstalledVersions)
                .then(determineTargetVersions)
                .then(checkMissing)
                //.then(checkDeleted)
                //.then(checkVersioning)
                .then(promptToUpdateIncompatible)
                .then(performUpdates)
                .then(verifyChanged)
                .then(printSummary)
                .then(function(){return Q(null).done();})
                .fail(RendererHelpers.reportFailure(logger, done))
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

            var pluginNames = fs.readdirSync(srcpath).filter(function(f) {
                var p = path.join(srcpath, f);
                return fs.lstatSync(p).isDirectory() && fs.existsSync(path.join(p, 'bower.json'));
            });

            pluginNames.forEach(function(name) {
                installedPlugins[name] = {group:group};
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
        /*var srcpath = path.join('src', group);

        if (!fs.existsSync(srcpath)) return [];

        return fs.readdirSync(srcpath).filter(function(f) {
            var p = path.join(srcpath, f);
            return fs.lstatSync(p).isDirectory() && fs.existsSync(path.join(p, 'bower.json'));
        });*/

        return _.filter(_.keys(installedPlugins), function(k) {
            return installedPlugins[k].group == group;
        });
    }

    function addPlugin(pluginName) {
        var tokens = pluginName.split(/[#@]/);
        switch (tokens.length) {
            case 1: bowerJson.dependencies[tokens[0]] = '*'; break;
            case 2: bowerJson.dependencies[tokens[0]] = tokens[1]; break;
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

    function createManifestFromAdaptJson() {
        if (!fs.existsSync('adapt.json')) return;
        var adaptJson = JsonLoader.readJSONSync('adapt.json');
        if (adaptJson && adaptJson.dependencies) bowerJson.dependencies = adaptJson.dependencies;
    }

    function createManifestFromArguments(args) {
        addSelectedPlugins(args);
    }

    function init(args) {
        logger.log();
        // if bower.json exists in project root tell user this will be used
        /*if (bowerExists) {
            return createYesNoPromptTask({
                message:chalk.bold.yellow('<confirm>'),
                description:chalk.reset('bower.json found in project root. This will be used to update your plugins. Do you wish to continue? Please specify (y)es or (n)o.')
            });
        }*/
        // if no arguments given tell user adapt.json will be used
        if (args.length == 0) {
            if (checkOnly) {
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
/*
            useAdaptJson = true;

            return createPromptTask({
                message:chalk.bold.yellow('<confirm>'),
                description:chalk.reset('adapt.json will be used to update your plugins. Hit <Enter> to continue.')
            })
            .then(createManifestFromAdaptJson);*/
        }
        // else process arguments
        return Q(args).then(createManifestFromArguments);
    }

    function checkRedundancy() {
        if (Object.keys(bowerJson.dependencies).length == 0) {
            return Q.reject('Nothing has been specified for update');
        } else {
            return Q.resolve();
        }
    }

    function createPlugins() {
        //console.log('createPlugins');

        Object.keys(bowerJson.dependencies).forEach(function(pluginName) {
            var plugin = Plugin.parse(pluginName+'#'+bowerJson.dependencies[pluginName]);
            plugin._versionIndex = 0;
            plugin._belongsTo = installedPlugins[pluginName].group;
            plugins.push(plugin);
        });

        return Q.all(plugins.map(getInfo)).progress(function() {
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

        // if plugin already at latest version then nothing to do
        if (semver.satisfies(plugin._installedVersion, plugin._bowerInfo.version)) {
            //console.log('no update available for', plugin.packageName);
            plugin._isAtLatestVersion = true;
            return Q.resolve();
        }

        //console.log('checking available updates for', plugin.packageName, 'with constraint', plugin.version, '(latest version is '+plugin._bowerInfo.version+')');
        
        return checkProposedVersion(plugin);
    }

    function checkProposedVersion(plugin, deferred) {
        //console.log(deferred)
        //if (deferred) console.log('deferred defined, deferred.resolve:', deferred.resolve);
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

    function getInfo(plugin) {
        var deferred = Q.defer();

        function onSuccess(results) {
            plugin._bowerInfo = results.latest || results;
            if (results.versions) plugin._versions = results.versions;
            deferred.notify();
            deferred.resolve(results);
        }

        function onFail() {
            plugin._isMissingAtRepo = true;
            deferred.notify();
            deferred.resolve();
        }

        try {
            //console.log('Querying registry for', plugin.packageName, '(' + plugin.version + ')');
            var versionString = plugin._versions ? '#'+plugin._versions[plugin._versionIndex] : '';
            bower.commands.info(plugin.packageName+versionString).on('end', onSuccess).on('error', onFail);
        } catch(err) {
            logger.log('bower throwing error');
            onFail();
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

    /*function resolveTypes() {
        plugins.filter(isPresent).forEach(function(plugin) {
            var keywords = plugin._bowerInfo.keywords,
                resolver = new PluginTypeResolver(),
                pluginType = resolver.resolve(keywords);

            plugin._belongsTo = pluginType.belongsTo;
        });

        return Q.resolve();
    }*/

    /*function checkDeleted() {
        return promise.serialise(plugins, function(plugin) {
            var p = path.join('src', plugin._belongsTo, plugin.packageName, 'bower.json');
            if (!fs.existsSync(p)) {
                plugin._isDeleted = true;

                return createYesNoPromptTask({
                    message:chalk.bold.yellow('<confirm>'),
                    description:chalk.reset(plugin.packageName, 'not installed. Would you like to install it?', 'Please specify (y)es or (n)o.'),
                    onlyRejectOnError: true
                })
                .then(function(result) {
                    plugin._shouldBeInstalled = this._shouldBeUpdated = result;
                });
            }
        });
    }*/

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

    function someOtherVersionSatisfiesConstraint(plugin) {
        var maxSatisfying = semver.maxSatisfying(plugin._versions, plugin.version);
        return maxSatisfying != null && !semver.satisfies(maxSatisfying, plugin._installedVersion);
    }

    /*function checkVersioning() {
        var adaptVersion = project.getFrameworkVersion();
        var allVersions = '*';

        logger.log(chalk.bold.cyan('<info>'), 'Project using Adapt', adaptVersion);

        plugins.filter(isPresent).forEach(function(plugin) {
            if (plugin._proposedVersion) {
                plugin._isCompatible = plugin._shouldBeUpdated = true;
            } else {
                plugin._isCompatible = plugin._shouldBeUpdated = false;
            }
        });

        return Q.resolve();
    }*/

    function promptToUpdateIncompatible() {
        //console.log('promptToUpdateIncompatible');
        var adaptVersion = project.getFrameworkVersion();
        // if there are no compatible updates but the user has requested a specific version (or range) and a corresponding version exists then prompt
        var list = plugins.filter(isPresent).filter(isIncompatible).filter(isConstrained).filter(someOtherVersionSatisfiesConstraint);

        if (list.length == 0) return Q.resolve();

        logger.log(chalk.bgRed('<warning>'), ' Changes have been requested for the following plugins, but no later compatible version exists. Please confirm each change:');

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

    function noteInstalledVersions() {
        //console.log('noteInstalledVersions');
        plugins.filter(isPresent).forEach(function(plugin) {
            //if (plugin._isDeleted) return;

            var p = path.join('src', plugin._belongsTo, plugin.packageName, 'bower.json');
            var j = JsonLoader.readJSONSync(p);

            plugin._installedVersion = j.version;
        });

        return Q.resolve();
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

        /*return Q.all(promises).progress(function() {
                settled++
                process.stderr.clearLine();
                process.stderr.cursorTo(0);
                process.stderr.write(chalk.bold.cyan('<info>')+' updates '+Math.round(100*settled/total)+'% complete');
            })
            .then(function() {
                process.stderr.write('\n');
            });*/
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

    function printDryRunSummary() {
        //console.log('printDryRunSummary');

        var present = plugins.filter(isPresent);
        var missing = plugins.filter(isMissing);
        var updateAvailable = present.filter(function(plugin){return plugin._proposedVersion});
        var updateNotAvailable = present.filter(function(plugin){return !plugin._proposedVersion});

        var byPackageName = function(a, b) {
            if (a.packageName < b.packageName) return -1;
            if (a.packageName > b.packageName) return 1;
            return 0;
        };

        if (updateAvailable.length > 0) logger.log('The following updates can be made:');

        updateAvailable.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._proposedVersion), '(latest is '+chalk.magentaBright(plugin._latestVersion)+')'));
        });

        if (updateAvailable.length > 0) logger.log('\n');

        if (updateNotAvailable.length > 0) logger.log('The following have no compatible updates:');

        updateNotAvailable.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)+' (latest is '+chalk.magentaBright(plugin._latestVersion)+')'));
        });

        if (updateNotAvailable.length > 0) logger.log('\n');

        missing.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.redBright(plugin.packageName, 'could not be found at the registry'));
        });
    }

    function printSummary() {
        logger.log(chalk.bold.cyan('<info>'), 'Operation completed. Update summary:');

        var present = plugins.filter(isPresent);
        var missing = plugins.filter(isMissing);
        var errored = present.filter(function(plugin) {return plugin._shouldBeUpdated && !plugin._wasUpdated});
        var updated = present.filter(function(plugin) {return plugin._wasUpdated});
        var latest = present.filter(function(plugin) {return plugin._isAtLatestVersion});
        var userSkipped = _.difference(present.filter(isConstrained).filter(isIncompatible).filter(someOtherVersionSatisfiesConstraint), updated, errored);
        var incompatibleConstrained = _.difference(present.filter(isIncompatible).filter(isConstrained), updated);
        var incompatible = _.difference(present.filter(isIncompatible), updated, incompatibleConstrained);

        var byPackageName = function(a, b) {
            if (a.packageName < b.packageName) return -1;
            if (a.packageName > b.packageName) return 1;
            return 0;
        };

        if (latest.length > 0) logger.log('The following plugins are using the latest version:');

        latest.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)));
        });

        if (latest.length > 0) logger.log('\n');

        if (incompatibleConstrained.length > 0) logger.log('The following plugins are using the requested version:');

        incompatibleConstrained.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)), '. Latest is', chalk.magentaBright(plugin._latestVersion));
        });

        if (incompatibleConstrained.length > 0) logger.log('\n');

        if (incompatible.length > 0) logger.log('The following plugins are using latest compatible version:');

        incompatible.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName+' @'+plugin._installedVersion)), '. Latest is', chalk.magentaBright(plugin._latestVersion));
        });

        if (incompatible.length > 0) logger.log('\n');

        if (incompatible.length > 0) logger.log('The following updates have been made:');

        updated.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.reset(highlight(plugin.packageName)), 'from', chalk.yellowBright(plugin._installedVersion), 'to', chalk.greenBright(plugin._updatedVersion)+'.', 'Latest is', chalk.magentaBright(plugin._latestVersion));
        });

        if (updated.length > 0) logger.log('\n');

        userSkipped.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.magenta(plugin.packageName, 'was skipped'));
        });

        if (userSkipped.length > 0) logger.log('\n');

        errored.sort(byPackageName).forEach(function(plugin) {
            logger.log(chalk.bold.redBright(plugin.packageName, 'could not be updated', '(error code '+plugin._updateError+')'));
        });

        if (errored.length > 0) logger.log('\n');

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
};
