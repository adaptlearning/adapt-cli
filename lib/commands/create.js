import {
  FRAMEWORK_REPOSITORY_NAME
} from '../integration/AdaptFramework.js'
import chalk from 'chalk'
import inquirer from 'inquirer'
import component from './create/component.js'
import course from './create/course.js'
import request from 'request'
import semver from 'semver'

export const DEFAULT_CREATE_TYPE = 'course'

export const DEFAULT_TYPE_NAME = {
  course: 'my-adapt-course',
  component: 'my-adapt-component'
}

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'

const subTasks = { component, course }

export default async function create (renderer) {
  const type = arguments.length >= 3 ? arguments[1] : DEFAULT_CREATE_TYPE
  const localDir = arguments.length >= 4 ? arguments[2] : undefined
  const branch = arguments.length >= 5 ? arguments[3] : undefined
  const tag = await checkLatestAdaptRepoVersion()
  const properties = await confirm({
    type: type,
    localDir: localDir,
    branch: branch || tag,
    renderer: renderer
  })
  const action = subTasks[properties.type]
  if (!action) throw new Error('' + properties.type + ' is not a supported type')
  try {
    await action(properties)
  } catch (err) {
    renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err.message)
    throw err
  }
}

async function confirm (properties) {
  const renderer = properties.renderer

  const typeSchema = [
    {
      name: 'type',
      choices: ['course', 'component'],
      type: 'list',
      default: properties.type
    }
  ]

  const typeSchemaResults = await inquirer.prompt(typeSchema)
  const propertySchema = [
    {
      name: 'localDir',
      message: 'name',
      type: 'input',
      default: properties.localDir || DEFAULT_TYPE_NAME[typeSchemaResults.type]
    },
    {
      name: 'branch',
      message: 'branch/tag',
      type: 'input',
      default: properties.branch || 'not specified'
    },
    {
      name: 'ready',
      message: 'create now?',
      type: 'confirm',
      default: true
    }
  ]

  const propertySchemaResults = await inquirer.prompt(propertySchema)
  if (!propertySchemaResults.ready) throw new Error('Aborted. Nothing has been created.')

  const finalProperties = Object.assign({},
    typeSchemaResults,
    propertySchemaResults,
    {
      renderer: renderer
    })
  return finalProperties
}

async function checkLatestAdaptRepoVersion (versionLimit) {
  // used in pagination
  let nextPage = `https://api.github.com/repos/adaptlearning/${FRAMEWORK_REPOSITORY_NAME}/releases`
  const processPage = async () => {
    const [response, body] = await new Promise((resolve, reject) => {
      request({
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        },
        uri: nextPage,
        method: 'GET'
      }, (error, response, body) => {
        if (error) return reject(error)
        resolve([response, body])
      })
    })
    if (response?.statusCode === 403 && response?.headers['x-ratelimit-remaining'] === '0') {
      // we've exceeded the API limit
      const reqsReset = new Date(response.headers['x-ratelimit-reset'] * 1000)
      throw new Error(`Couldn't check latest version of ${FRAMEWORK_REPOSITORY_NAME}. You have exceeded GitHub's request limit of ${response.headers['x-ratelimit-limit']} requests per hour. Please wait until at least ${reqsReset.toTimeString()} before trying again.`)
    }
    if (response?.statusCode !== 200) {
      throw new Error(`Couldn't check latest version of ${FRAMEWORK_REPOSITORY_NAME}. GitubAPI did not respond with a 200 status code.`)
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
      throw new Error(`Failed to parse GitHub release data\n${e}`)
    }
    const compatibleRelease = releases.find(release => {
      const isFullRelease = !release.draft && !release.prerelease
      const satisfiesVersion = !versionLimit || semver.satisfies(release.tag_name, versionLimit)
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
