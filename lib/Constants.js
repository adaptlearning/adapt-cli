var bower = require('bower'),
    fs = require('fs');

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
    Registry: getRegistry(),
    HomeDirectory : searchForHome(),
    MaxAttempts: 2
};

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
    if (process.env.ADAPT_REGISTRY) return process.env.ADAPT_REGISTRY;
    if (fs.existsSync('./.bowerrc')) return bower.config.registry.publish;
    return 'http://adapt-bower-repository.herokuapp.com/';
}
