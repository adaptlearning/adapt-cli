var semver = require('semver');

var VersionChecker = function (RendererHelpers, Q) {
    this.RendererHelpers = RendererHelpers;
    this.Q = Q;
};

VersionChecker.prototype.assertVersionCompatibility = function (adaptVersion, compatibleVersionRange) {
    var any = /\*|>=0.0.0/;
    if(semver.gte(adaptVersion, '2.0.0') && any.test(compatibleVersionRange)) {
        return false;
    }
    return semver.satisfies(adaptVersion, compatibleVersionRange);
};

module.exports = VersionChecker;