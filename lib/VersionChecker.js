import semver from 'semver'

export default {
  assertVersionCompatibility: function (adaptVersion, compatibleVersionRange) {
    return semver.satisfies(adaptVersion, compatibleVersionRange)
  }
}
