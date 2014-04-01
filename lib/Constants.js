module.exports = {
    DefaultProjectManifestPath : './adapt.json',
    DefaultCreateType : 'course',
    DefaultCourseName : 'my-adapt-course',
    FrameworkRepository : process.env.ADAPT_FRAMEWORK || 'https://github.com/adaptlearning/adapt_framework',
    FrameworkRepositoryName : 'adapt_framework',
    DefaultBranch : process.env.ADAPT_BRANCH || 'master',
    Registry: process.env.ADAPT_REGISTRY || 'http://adapt-bower-repository.herokuapp.com/',
    HomeDirectory : searchForHome(),
};

function searchForHome() {
    var fs = require('fs'),
        locations = [
            process.env.HOME,
            (process.env.HOMEDRIVE + process.env.HOMEPATH),
            process.env.USERPROFILE,
            '/tmp',
            '/temp',
        ];
    var validLocations =  locations.filter(fs.existsSync);
    return validLocations[0];
}