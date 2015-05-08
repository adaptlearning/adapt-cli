var semver = require('semver');

module.exports = {
    assertVersionCompatibility: function (adaptVersion, compatibleVersionRange) {
        var any = /\*|>=0.0.0/;
        if(semver.gte(adaptVersion, '2.0.0') && any.test(compatibleVersionRange)) {
            return false;
        }
        return semver.satisfies(adaptVersion, compatibleVersionRange);
    }
};