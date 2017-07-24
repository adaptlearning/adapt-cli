var bower = require('bower');
var chalk = require('chalk');
var fs = require('fs');
var _ = require('lodash')
var path = require('path');
var prompt = require('prompt')
var Q = require('q');
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

    return {
        update: function(renderer) {
            var args = [].slice.call(arguments, 1);
            var done = args.pop() || function() {};

            logger = renderer;
            bowerExists = fs.existsSync('bower.json');

            // cleanup any errant temporary manifest
            if (bowerExists && JsonLoader.readJSONSync('bower.json')._managedByAdaptCli) {
                bowerExists = false;
                clean();
            }

            bowerJson = bowerExists ? JsonLoader.readJSONSync('bower.json') : {"name":"temporary-manifest", "_managedByAdaptCli":true, "dependencies":{}};
            project = new Project(Constants.DefaultProjectManifestPath, Constants.DefaultProjectFrameworkPath);
            plugins = [];

            init(args)
            .then(checkRedundancy)
            .then(createPlugins)
            .then(checkMissing)
            .then(checkVersioning)
            .then(promptToUpdateIncompatible)
            .then(performUpdates)
            .then(printSummary)
            .then(function(){return Q(null).done();})
            .fail(RendererHelpers.reportFailure(logger, done))
            .finally(clean);
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
        var srcpath = path.join('src', group);

        if (!fs.existsSync(srcpath)) return [];

        return fs.readdirSync(srcpath).filter(function(f) {
            var p = path.join(srcpath, f);
            return fs.lstatSync(p).isDirectory() && fs.existsSync(path.join(p, 'bower.json'));
        });
    }

    function addPlugin(pluginName) {
        var tokens = pluginName.split('#');
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

        //JsonWriter.writeJSONSync('bower.json', bowerJson);
    }

    function createManifestFromArguments(args) {
        addSelectedPlugins(args);

        //JsonWriter.writeJSONSync('bower.json', bowerJson);
    }

    function init(args) {
        logger.log();
        // if bower.json exists in project root tell user this will be used
        if (bowerExists) {
            return createYesNoPromptTask({
                message:chalk.bold.yellow('<confirm>'),
                description:chalk.reset('bower.json found in project root. This will be used to update your plugins. Do you wish to continue? Please specify (y)es or (n)o.')
            });
        }
        // else if no arguments given tell user adapt.json will be used
        else if (args.length == 0) {
            return createYesNoPromptTask({
                message:chalk.bold.yellow('confirm'),
                description:chalk.reset('adapt.json will be used to update your plugins. Do you wish to continue? Please specify (y)es or (n)o.')
            })
            .then(createManifestFromAdaptJson);
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
        //console.log('Creating plugins from manifest:\n', chalk.green(JSON.stringify(bowerJson, null, 2)));

        Object.keys(bowerJson.dependencies).forEach(function(dep) {
            plugins.push(Plugin.parse(dep+'#'+bowerJson.dependencies[dep]));
        });

        return Q.all(plugins.map(getInfo));
    }

    function getInfo(plugin) {
        var deferred = Q.defer();

        function onSuccess(results) {
            plugin._bowerInfo = results.latest || results;
            deferred.resolve(results);
        }

        function onFail() {
            logger.log(plugin.packageName, 'not found at registry');
            plugin._isMissing = true;
            deferred.resolve();
        }

        try {
            //console.log('Querying registry for', plugin.packageName, '(' + plugin.version + ')');
            bower.commands.info(plugin.toString()).on('end', onSuccess).on('error', onFail);
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

    function isMissing(plugin) {
        return plugin._isMissing === true;
    }

    function isPresent(plugin) {
        return !isMissing(plugin);
    }

    function isIncompatible(plugin) {
        return plugin._isCompatible === false;
    }

    function isToBeUpdated(plugin) {
        return plugin._shouldBeUpdated && !plugin._wasUpdated;
    }

    function checkVersioning() {
        var adaptVersion = project.getFrameworkVersion();
        var allVersions = '*';

        logger.log(chalk.bold.cyan('<info> project using Adapt', adaptVersion));

        plugins.filter(isPresent).forEach(function(plugin) {
            plugin._isCompatible = VersionChecker.assertVersionCompatibility(adaptVersion, plugin._bowerInfo.framework || allVersions);
            if (plugin._isCompatible) plugin._shouldBeUpdated = true;
            //console.log(plugin.packageName, plugin._bowerInfo.framework, 'compatible='+plugin._isCompatible);
        });

        return Q.resolve();
    }

    function promptToUpdateIncompatible() {
        var adaptVersion = project.getFrameworkVersion();

        if (plugins.filter(isIncompatible).length == 0) return;

        logger.log(chalk.bgRed('<warning>'), ' some of the requested updates are incompatible with this version of Adapt');

        return promise.serialise(plugins.filter(isPresent), function(plugin) {
            if (!plugin._isCompatible) {
                return createPromptTask({
                    message: chalk.bold.yellow('<confirm>'),
                    description: chalk.reset('Update ' + plugin.packageName + ' anyway (requires ' + plugin._bowerInfo.framework + ')? Please specify (y)es or (n)o'),
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
            }
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

    function printSummary() {
        logger.log('Operation completed. Update summary:');

        plugins.forEach(function(plugin) {
            if (plugin._shouldBeUpdated) {
                if (plugin._wasUpdated) {
                    logger.log(chalk.green(plugin.packageName, 'is up to date'));
                }
            } else {
                logger.log(chalk.bold.yellow(plugin.packageName, 'was skipped'));
            }
        });

        plugins.forEach(function(plugin) {
            if (plugin._shouldBeUpdated) {
                if (!plugin._wasUpdated) {
                    logger.log(chalk.bold.red(plugin.packageName, 'could not be updated', '(error code '+plugin._updateError+')'));
                }
            }
        });

        return Q.resolve();
    }

    function clean() {
        if (!bowerExists) {
            fs.unlinkSync('bower.json');
        }
        return Q.resolve();
    }

    function createUpdateTask(plugin) {
        //console.log(plugin.packageName, 'is missing', !!plugin._isMissing, 'is ignored',!plugin._shouldBeUpdated);

        var keywords = plugin._bowerInfo.keywords;
        var resolver = new PluginTypeResolver(),
        pluginType = resolver.resolve(keywords);

        return Q.when(null, function() {
                var deps = {};
                var manifest;

                // create bower.json with a single dependency, otherwise bower will install things incorrectly
                deps[plugin.packageName] = plugin.version;
                manifest = _.extend({}, bowerJson, {dependencies:deps});
                
                //console.log('manifest\n', JSON.stringify(manifest, null, 4));
                JsonWriter.writeJSONSync('bower.json', manifest);
                //console.log(JSON.stringify(JsonLoader.readJSONSync('bower.json'), null, 4));
                return update(plugin, null, {
                    directory: path.join('src', pluginType.belongsTo),
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
        var list = plugins.filter(isPresent).filter(isToBeUpdated);
        var total = list.length;
        var settled = _.filter(list, function(item) {return _.isBoolean(item._wasUpdated);}).length;
        //console.log('progress', settled, total);
        process.stderr.clearLine();
        process.stderr.cursorTo(0);
        process.stderr.write(chalk.bold.cyan('<info>')+' updates '+Math.round(100*settled/total)+'% complete');
    }

    function renderUpdateProgressFinished() {
        process.stderr.write('\n');
    }
};
