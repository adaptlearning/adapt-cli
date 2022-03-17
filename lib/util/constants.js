import fs from 'fs-extra'

export const ADAPT_ALLOW_PRERELEASE = process.env.ADAPT_ALLOW_PRERELEASE !== 'false'

export const ADAPT_FRAMEWORK = process.env.ADAPT_FRAMEWORK || 'https://github.com/adaptlearning/adapt_framework'

export const ADAPT_COMPONENT = process.env.ADAPT_COMPONENT || 'https://github.com/adaptlearning/adapt-component'

export const ADAPT_QUESTION = process.env.ADAPT_QUESTION || 'https://github.com/adaptlearning/adapt-questionComponent'

export const ADAPT_DEFAULT_USER_AGENT = process.env.ADAPT_DEFAULT_USER_AGENT || 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'

export const HOME_DIRECTORY = [
  process.env.HOME,
  (process.env.HOMEDRIVE + process.env.HOMEPATH),
  process.env.USERPROFILE,
  '/tmp',
  '/temp'
].filter(fs.existsSync)[0]

/** @type {string} */
export const PLUGIN_TYPES = [
  'component',
  'extension',
  'menu',
  'theme'
]

/** @type {Object} */
export const PLUGIN_TYPE_FOLDERS = {
  component: 'components',
  extension: 'extensions',
  menu: 'menu',
  theme: 'theme'
}

/** @type {string} */
export const PLUGIN_DEFAULT_TYPE = PLUGIN_TYPES[0]
