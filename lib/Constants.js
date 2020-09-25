var bower = require('bower'),
    fs = require('fs'),
    path = require('path');

module.exports = {
    ManifestFilename: 'adapt.json',
    FrameworkFilename: 'package.json',
    DefaultProjectManifestPath: './adapt.json',
    DefaultProjectFrameworkPath: './package.json',
    DefaultCreateType : 'course',
    DefaultTypeNames : {
        'course':'my-adapt-course',
        'component':'my-adapt-component'
    },
    DefaultUserAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36',
    DefaultGitHubOrg: 'adaptlearning',
    FrameworkRepository : process.env.ADAPT_FRAMEWORK || 'https://github.com/adaptlearning/adapt_framework',
    FrameworkRepositoryName : 'adapt_framework',
    ComponentRepository : process.env.ADAPT_COMPONENT || 'https://github.com/adaptlearning/adapt-component',
    ComponentRepositoryName : 'adapt-component',
    DefaultBranch : process.env.ADAPT_BRANCH || 'master',
    HomeDirectory : searchForHome(),
    getRegistry:getRegistry,
    setCwd: setCwd,
    cwd: '.'
};

var registry = null;

function searchForHome() {
    var locations = [
            process.env.HOME,
            (process.env.HOMEDRIVE + process.env.HOMEPATH),
            process.env.USERPROFILE,
            '/tmp',
            '/temp',
        ];
    var validLocations =  locations.filter(fs.existsSync);
    return validLocations[0];
}

function getRegistry() {
    if (registry !== null) {
        return registry;
    }

    if (process.env.ADAPT_REGISTRY) {
        registry = process.env.ADAPT_REGISTRY;

    } else if (fs.existsSync(path.join(this.cwd, './.bowerrc'))) {
        // a manifest exists; let bower determine the registry
        registry = undefined;
        
    } else {
        // use the default Adapt registry
        registry = 'http://adapt-bower-repository.herokuapp.com/';
    }

    return registry;
}

function setCwd(cwd) {
    if (!cwd) return;

    this.cwd = cwd;

    this.DefaultProjectManifestPath = path.join(this.cwd, this.ManifestFilename);
    this.DefaultProjectFrameworkPath = path.join(this.cwd, this.FrameworkFilename);
}
