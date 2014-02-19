module.exports = {
    DefaultProjectManifestPath : './adapt.json',
    DefaultCreateType : 'course',
    DefaultCourseName : 'My Adapt Course',
    FrameworkRepository : process.env.ADAPT_FRAMEWORK || 'https://github.com/adaptlearning/adapt_framework',
    FrameworkRepositoryName : 'adapt_framework',
    DefaultBranch : process.env.ADAPT_BRANCH || 'master',
    HomeDirectory : process.env.USERPROFILE || process.env.HOME || (process.env.HOMEDRIVE + process.env.HOMEPATH),
    Registry: process.env.ADAPT_REGISTRY || 'http://adapt-bower-repository.herokuapp.com/'
};