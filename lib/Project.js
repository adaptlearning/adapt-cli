var Plugin = require('./Plugin'),
    fs = require('fs'),
    _ = require('lodash'),
    JsonLoader = require('./JsonLoader'),
    chalk = require('chalk'),
    renderer =  require('./ConsoleRenderer'),
    EmptyProject = function (){
        return {
            dependencies: {}
        };
    };

var Project = function (manifestFilePath, frameworkPackagePath) {
    this.manifestFilePath = manifestFilePath;
    this.frameworkPackagePath = frameworkPackagePath;
    Object.defineProperty(this, 'plugins', {
        get: function () {
            var manifest = parse(this.manifestFilePath);
            return _.toPairs(manifest.dependencies)
                    .map(function (pair) {
                        return new Plugin(pair[0], pair[1]);
                    });
        }.bind(this)
    });
};

Project.prototype.add = function (plugin) {
    if(typeof Plugin !== 'object' && plugin.constructor !== Plugin) {
        plugin = new Plugin(plugin);
    }
    var manifest = parse(this.manifestFilePath);
    manifest.dependencies[plugin.packageName] = plugin.version;
    save(this.manifestFilePath, manifest);
};

Project.prototype.remove = function (plugin) {
    if(typeof Plugin !== 'object' && plugin.constructor !== Plugin) {
        plugin = new Plugin(plugin);
    }
    var manifest = parse(this.manifestFilePath);
    delete manifest.dependencies[plugin.packageName];
    save(this.manifestFilePath, manifest);
};

Project.prototype.getFrameworkVersion = function () {
    return parsePackage(this.frameworkPackagePath).version;
};

function parse(manifestFilePath) {
    if(!manifestFilePath) return EmptyProject();

    try {
        return JsonLoader.readJSONSync(manifestFilePath);
    }
    catch (ex) {
        renderer.log(chalk.red('Unable to find the file adapt.json'));
        return process.exit(1);
    }
}

function parsePackage(frameworkPackagePath) {
    var EmptyPackage = function () {
        return { "version": "0.0.0" }
    };

    if(!frameworkPackagePath) return EmptyPackage();

    try {
        return JsonLoader.readJSONSync(frameworkPackagePath);
    }
    catch (ex) {
        return EmptyPackage();
    }
}

function save(manifestFilePath, manifest) {
    if(manifestFilePath) {
        fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 4));
    }
}

module.exports = Project;
