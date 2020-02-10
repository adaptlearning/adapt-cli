var bower = require('bower'),
    fs = require('fs'),
    path = require('path');

module.exports = {
    DefaultProjectManifestPath : './adapt.json',
    DefaultProjectFrameworkPath: './package.json',
    DefaultCreateType : 'course',
    DefaultTypeNames : {
        'course':'my-adapt-course',
        'component':'my-adapt-component'
    },
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

    console.log('setting cwd to', cwd);

    this.cwd = cwd;

    this.DefaultProjectManifestPath = path.join(this.cwd, this.DefaultProjectManifestPath);
    this.DefaultProjectFrameworkPath = path.join(this.cwd, this.DefaultProjectFrameworkPath);

    console.log(this.DefaultProjectManifestPath);
    console.log(this.DefaultProjectFrameworkPath);
}