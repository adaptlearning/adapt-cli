var Plugin = require('./Plugin'),
    fs = require('fs')
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
            return _.keys(manifest.dependencies)
                    .map(function (pluginName) {
                        return new Plugin(pluginName);
                    });
        }.bind(this)
    });
};

Project.prototype.add = function (plugin) {
    if(typeof Plugin !== 'Plugin') {
        plugin = new Plugin(plugin);
    }
    var manifest = parse(this.manifestFilePath);
    manifest.dependencies[plugin.packageName] = plugin.version || '0.0.0';
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