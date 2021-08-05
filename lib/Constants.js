import fs from 'fs'
import path from 'path'
import Cwd from './Cwd.js'

export const BOWER_REGISTRY_URL = (function getRegistry () {
  if (process.env.ADAPT_REGISTRY) {
    return process.env.ADAPT_REGISTRY
  }
  if (fs.existsSync(path.join(Cwd(), './.bowerrc'))) {
  // a manifest exists; let bower determine the registry
    return
  }
  // use the default Adapt registry
  return 'http://adapt-bower-repository.herokuapp.com/'
})()

export const HOME_DIRECTORY = (function getHomeDirectory () {
  const locations = [
    process.env.HOME,
    (process.env.HOMEDRIVE + process.env.HOMEPATH),
    process.env.USERPROFILE,
    '/tmp',
    '/temp'
  ]
  const validLocations = locations.filter(fs.existsSync)
  return validLocations[0]
})()

export const MANIFEST_FILENAME = 'adapt.json'

export const FRAMEWORK_FILENAME = 'pacakage.json'

export function DEFAULT_PROJECT_MANIFEST_PATH () { return path.join(Cwd(), MANIFEST_FILENAME) }

export function DEFAULT_PROJECT_FRAMEWORK_PATH () { return path.join(Cwd(), FRAMEWORK_FILENAME) }

export const DEFAULT_CREATE_TYPE = 'course'

export const DEFAULT_TYPE_NAME = {
  course: 'my-adapt-course',
  component: 'my-adapt-component'
}

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'

export const DEFAULT_GITHUB_ORG = 'adaptlearning'

export const FRAMEWORK_REPOSITORY_NAME = 'adapt_framework'

export const FRAMEWORK_REPOSITORY = process.env.ADAPT_FRAMEWORK || `https://github.com/${DEFAULT_GITHUB_ORG}/${FRAMEWORK_REPOSITORY_NAME}`

export const COMPONENT_REPOSITORY_NAME = 'adapt-component'

export const COMPONENT_REPOSITORY = process.env.ADAPT_COMPONENT || `https://github.com/${DEFAULT_GITHUB_ORG}/${COMPONENT_REPOSITORY_NAME}`
