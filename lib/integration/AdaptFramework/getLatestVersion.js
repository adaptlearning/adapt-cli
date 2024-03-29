import fetch from 'node-fetch'
import semver from 'semver'
import gh from 'parse-github-url'
import { ADAPT_DEFAULT_USER_AGENT, ADAPT_FRAMEWORK, ADAPT_ALLOW_PRERELEASE } from '../../util/constants.js'
const semverOptions = { includePrerelease: ADAPT_ALLOW_PRERELEASE }

export default async function getLatestVersion ({ versionLimit, repository = ADAPT_FRAMEWORK }) {
  repository = repository.replace(/\.git/g, '')
  const OWNER = gh(repository).owner
  const NAME = gh(repository).name
  // used in pagination
  let nextPage = `https://api.github.com/repos/${OWNER}/${NAME}/releases`
  // taken from https://gist.github.com/niallo/3109252
  const parseLinkHeader = header => {
    if (!header || header.length === 0) {
      return []
    }
    const links = {}
    // Parse each part into a named link
    header.split(',').forEach(p => {
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
  const processPage = async () => {
    const response = await fetch(nextPage, {
      headers: {
        'User-Agent': ADAPT_DEFAULT_USER_AGENT
      },
      method: 'GET'
    })
    const body = await response.text()
    if (response?.status === 403 && response?.headers['x-ratelimit-remaining'] === '0') {
      // we've exceeded the API limit
      const reqsReset = new Date(response.headers['x-ratelimit-reset'] * 1000)
      throw new Error(`Couldn't check latest version of ${NAME}. You have exceeded GitHub's request limit of ${response.headers['x-ratelimit-limit']} requests per hour. Please wait until at least ${reqsReset.toTimeString()} before trying again.`)
    }
    if (response?.status !== 200) {
      throw new Error(`Couldn't check latest version of ${NAME}. GitubAPI did not respond with a 200 status code.`)
    }
    nextPage = parseLinkHeader(response.headers.link).next
    let releases
    try {
      // parse and sort releases (newest first)
      releases = JSON.parse(body).sort((a, b) => {
        if (semver.lt(a.tag_name, b.tag_name, semverOptions)) return 1
        if (semver.gt(a.tag_name, b.tag_name, semverOptions)) return -1
        return 0
      })
    } catch (e) {
      throw new Error(`Failed to parse GitHub release data\n${e}`)
    }
    const compatibleRelease = releases.find(release => {
      const isFullRelease = !release.draft && !release.prerelease
      const satisfiesVersion = !versionLimit || semver.satisfies(release.tag_name, versionLimit, semverOptions)
      if (!isFullRelease || !satisfiesVersion) return false
      return true
    })
    if (!compatibleRelease && nextPage) {
      return await processPage()
    }
    if (!compatibleRelease) {
      throw new Error(`Couldn't find any releases compatible with specified framework version (${versionLimit}), please check that it is a valid version.`)
    }
    return compatibleRelease.tag_name
  }
  return await processPage()
}
