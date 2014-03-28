var Plugin = require('./Plugin'),
    fs = require('fs'),
    _ = require('lodash'),
    JsonLoader = require('./JsonLoader'),
    EmptyProject = {
        dependencies: {}
    };

var Project = function (path) {
    this.manifestFilePath = path;
    Object.defineProperty(this, 'plugins', {
        get: function () {
            var manifest = parse(this.manifestFilePath);
            return _.pairs(manifest.dependencies)
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

function parse(manifestFilePath) {
    if(!manifestFilePath) return EmptyProject;

    try {
        return JsonLoader.readJSONSync(manifestFilePath);
    }
    catch (ex) {
        return EmptyProject;
    }
}

function save(manifestFilePath, manifest) {
    if(manifestFilePath) {
        fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 4));
    }
}

module.exports = Project;