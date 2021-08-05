import {
  DEFAULT_GITHUB_ORG,
  DEFAULT_USER_AGENT,
  FRAMEWORK_REPOSITORY_NAME
} from '../CONSTANTS.js'
import async from 'async'
import Q from 'q'
import request from 'request'
import semver from 'semver'

export default function () {
  const deferred = Q.defer()

  checkLatestAdaptRepoVersion(function (error, latestFrameworkTag) {
    if (error) {
      deferred.reject(error)
    } else {
      deferred.resolve(latestFrameworkTag)
    }
  })

  return deferred.promise
}

function checkLatestAdaptRepoVersion (versionLimit, callback) {
  if (typeof versionLimit === 'function') {
    callback = versionLimit
    versionLimit = undefined
  }
  // used in pagination
  let nextPage = `https://api.github.com/repos/${DEFAULT_GITHUB_ORG}/${FRAMEWORK_REPOSITORY_NAME}/releases`

  const _getReleases = function (done) {
    request({
      headers: {
        'User-Agent': DEFAULT_USER_AGENT
      },
      uri: nextPage,
      method: 'GET'
    }, done)
  }
  const _requestHandler = function (error, response, body) {
    if (response) {
      // we've exceeded the API limit
      if (response.statusCode === 403 && response.headers['x-ratelimit-remaining'] === '0') {
        const reqsReset = new Date(response.headers['x-ratelimit-reset'] * 1000)
        error = `You have exceeded GitHub's request limit of ${response.headers['x-ratelimit-limit']} requests per hour. Please wait until at least ${reqsReset.toTimeString()} before trying again.`
      } else if (response.statusCode !== 200) {
        error = 'GitubAPI did not respond with a 200 status code.'
      }
    }
    if (error) {
      return callback(new Error(`Couldn't check latest version of ${FRAMEWORK_REPOSITORY_NAME}. ${error}`))
    }
    nextPage = parseLinkHeader(response.headers.link).next
    let releases
    try {
      // parse and sort releases (newest first)
      releases = JSON.parse(body).sort((a, b) => {
        if (semver.lt(a.tag_name, b.tag_name)) return 1
        if (semver.gt(a.tag_name, b.tag_name)) return -1
        return 0
      })
    } catch (e) {
      return callback(new Error(`Failed to parse GitHub release data\n${e}`))
    }
    let compatibleRelease
    async.someSeries(releases, function (release, cb) {
      const isFullRelease = !release.draft && !release.prerelease
      const satisfiesVersion = !versionLimit || semver.satisfies(release.tag_name, versionLimit)

      if (!isFullRelease || !satisfiesVersion) {
        return cb(null, false)
      }

      compatibleRelease = release
      return cb(null, true)
    }, function (error, satisfied) {
      if (!satisfied) {
        if (nextPage) {
          return _getReleases(_requestHandler)
        }
        error = new Error(`Couldn't find any releases compatible with specified framework version (${versionLimit}), please check that it is a valid version.`)
      }
      if (error) {
        return callback(error)
      }
      callback(error, compatibleRelease.tag_name)
    })
  }
  // start recursion
  _getReleases(_requestHandler)
}

// taken from https://gist.github.com/niallo/3109252
function parseLinkHeader (header) {
  if (!header || header.length === 0) {
    return []
  }
  const links = {}
  // Parse each part into a named link
  header.split(',').forEach(function (p) {
    const section = p.split(';')
    if (section.length !== 2) {
      throw new Error("section could not be split on ';'")
    }
    const url = section[0].replace(/<(.*)>/, '$1').trim()
    const name = section[1].replace(/rel="(.*)"/, '$1').trim()
    links[name] = url
  })
  return links
}
