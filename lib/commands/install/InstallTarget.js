import Cwd from '../../Cwd.js'
import {
  BOWER_REGISTRY_URL
} from '../../CONSTANTS.js'
import bower from 'bower'
import Q from 'q'
import endpointParser from 'bower-endpoint-parser'
import semver from 'semver'
import Plugin from '../../Plugin.js'

const any = '*'
const BOWER_MAX_TRY = 5

class InstallTarget extends Plugin {
  constructor (name, requestedVersion, isCompatibleEnabled) {
    const endpoint = name + '#' + (isCompatibleEnabled ? any : requestedVersion)
    const ep = endpointParser.decompose(endpoint)
    const version = /^\*$/.test(ep.target) ? any : ep.target
    super(ep.name || ep.source, version)
    let proposal

    if (this.version !== any) {
      proposal = this.version
      this._isConstrained = true
      this.version = semver.validRange(proposal)

      if (!this.version) {
        throw new Error(this.packageName + ' "' + proposal + '" is not a valid constraint')
      }
    }

    // the constraint given by the user
    this._requestedVersion = requestedVersion
    // the result of the current query to the server
    this._rawInfo = undefined
    // information about a particular version of the plugin
    this._versionInfo = undefined
    // the number of attempts made to query the server
    this._bowerCmdCount = 0
    // a list of tags denoting the versions of the plugin
    this._versions = undefined
    // an index denoting which version is being queried
    this._versionIndex = 0
    // whether querying the server for plugin information failed at all
    this._isMissingAtRepo = false
    // the most recent version of the plugin compatible with the given framework
    this._latestCompatibleVersion = undefined
    // the most recent version of the plugin
    this._latestVersion = undefined
    // whether the user supplied a constraint that is not supported by the plugin
    this._isBadConstraint = false
    // whether the constraint has been checked for compatibility
    this._constraintChecked = false
    // a non-wildcard constraint resolved to the highest version of the plugin that satisfies the constraint and is compatible with the framework
    this._resolvedConstraint = undefined
    // the version to be installed
    this._versionToInstall = undefined
  }

  getInitialInfo () {
    return this.getInfo().then(processInfo.bind(this))

    function processInfo () {
      if (!this._isMissingAtRepo) {
        this._latestVersion = this._versionInfo.version

        if (this._rawInfo.versions) {
          this._versions = this._rawInfo.versions
          if (this._versions.length > 0) {
            // check if the user supplied a constraint that cannot be met
            this._isBadConstraint = semver.maxSatisfying(this._versions, this.version) === null
          }
        }
      }
    }
  }

  getInfo (deferred) {
    // presence of deferred signifies a retry
    if (!deferred) this._bowerCmdCount = 0

    deferred = deferred || Q.defer()

    try {
      const versionString = this._versions ? '#' + this._versions[this._versionIndex] : ''
      this._bowerCmdCount++
      bower.commands.info(this.packageName + versionString, null, { registry: BOWER_REGISTRY_URL, cwd: Cwd() }).on('end', onSuccess.bind(this)).on('error', onFail.bind(this))
    } catch (err) {
      onFail.call(this, err)
    }

    function onSuccess (results) {
      this._rawInfo = results
      this._versionInfo = results.latest || results
      deferred.notify()
      deferred.resolve(results)
    }

    function onFail () {
      if (this._bowerCmdCount < BOWER_MAX_TRY) {
        this.getInfo(deferred)
      } else {
        this._isMissingAtRepo = true
        deferred.notify()
        deferred.resolve()
      }
    }

    return deferred.promise
  }

  findCompatibleVersion (framework) {
    if (this._isMissingAtRepo) return Q.resolve()

    // check if the latest version is compatible
    if (semver.satisfies(framework, this._versionInfo.framework)) {
      this._latestCompatibleVersion = this._versionInfo.version || '*'
      return Q.resolve()
    }

    // if the plugin has no tags then there are no other versions to check
    if (!this._versions || this._versions.length === 0) return Q.resolve()

    this._versionIndex = 0

    return this.checkProposedVersion(framework)
  }

  checkConstraint (framework) {
    // check that the plugin exists
    if (this._isMissingAtRepo) {
      this._constraintChecked = true
      // InstallLog.log(this.packageName, 'cannot resolve constraint due to missing info');
      return Q.resolve()
    }

    // check that there are other versions to be considered
    if (!this._versions || this._versions.length === 0) {
      this._constraintChecked = true
      // InstallLog.log(this.packageName, 'cannot resolve constraint because there are no tags');
      return Q.resolve()
    }

    // check that a valid constraint exists
    if (this.version === any || this._isBadConstraint) {
      this._constraintChecked = true
      // InstallLog.log(this.packageName, 'cannot resolve constraint because a valid constraint has not been given');
      return Q.resolve()
    }

    this._versionIndex = 0

    return this.getInfo().then(() => {
      return this.checkConstraintCompatibility(framework)
    })
  }

  // find the highest version that satisfies the constraint and is compatible with the framework
  checkConstraintCompatibility (framework, deferred) {
    deferred = deferred || Q.defer()

    // give up if there is any failure to obtain version info
    if (this._isMissingAtRepo) {
      this._constraintChecked = true
      // InstallLog.log(this.packageName, 'cannot resolve constraint due to missing info');
      deferred.notify()
      deferred.resolve()
      return deferred.promise
    }

    // InstallLog.log(this.packageName, 'checking', this._versionInfo.version, 'against', this.version, 'framework', framework);

    // check if the version satisfies the constraint and whether the version is compatible
    if (semver.satisfies(this._versionInfo.version, this.version) && semver.satisfies(framework, this._versionInfo.framework)) {
      this._resolvedConstraint = this._versionInfo.version
      this._constraintChecked = true
      // InstallLog.log(this.packageName, 'resolved constraint to', this._resolvedConstraint);
      deferred.notify()
      deferred.resolve()
    } else {
      if (this._versionIndex + 1 < this._versions.length) {
        this._versionIndex++

        this.getInfo().then(() => {
          return this.checkConstraintCompatibility(framework, deferred)
        })
      } else {
        this._resolvedConstraint = null
        this._constraintChecked = true
        // InstallLog.log(this.packageName, 'cannot resolve constraint');
        deferred.notify()
        deferred.resolve()
      }
    }

    return deferred.promise
  }

  // find the highest version that is compatible with the framework
  checkProposedVersion (framework, deferred) {
    deferred = deferred || Q.defer()

    // give up if there is any failure to obtain version info
    if (this._isMissingAtRepo) {
      this._latestCompatibleVersion = null
      deferred.notify()
      deferred.resolve()
      return deferred.promise
    }

    // check that the proposed plugin is compatible with the installed framework
    if (semver.satisfies(framework, this._versionInfo.framework)) {
      this._latestCompatibleVersion = this._versionInfo.version
      deferred.notify()
      deferred.resolve()
    } else {
      if (this._versionIndex + 1 < this._versions.length) {
        this._versionIndex++

        this.getInfo().then(() => {
          this.checkProposedVersion(framework, deferred)
        })
      } else {
        this._latestCompatibleVersion = null
        deferred.notify()
        deferred.resolve()
      }
    }

    return deferred.promise
  }

  markRequestedForInstallation () {
    if (this._resolvedConstraint !== undefined && this._resolvedConstraint !== null) {
      this._versionToInstall = this._resolvedConstraint
    } else {
      this._versionToInstall = semver.maxSatisfying(this._versions, this.version)
    }
  }

  markLatestCompatibleForInstallation () {
    this._versionToInstall = this._latestCompatibleVersion
  }

  markLatestForInstallation () {
    this._versionToInstall = this._latestVersion
  }

  logToConsole () {
    console.log(this.packageName, this.version, this._versionInfo ? this._versionInfo.framework : 'missing')
  }
}

export default InstallTarget
