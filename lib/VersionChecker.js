var semver = require('semver');

module.exports = {
    assertVersionCompatibility: function (adaptVersion, compatibleVersionRange) {
        return semver.satisfies(adaptVersion, compatibleVersionRange);
    }
};