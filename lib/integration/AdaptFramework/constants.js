import fs from 'fs-extra'

// TODO: externalise these defaults

export const FRAMEWORK_REPOSITORY_NAME = 'adapt_framework'

export const FRAMEWORK_REPOSITORY = process.env.ADAPT_FRAMEWORK || `https://github.com/adaptlearning/${FRAMEWORK_REPOSITORY_NAME}`

export const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'

export const HOME_DIRECTORY = [
  process.env.HOME,
  (process.env.HOMEDRIVE + process.env.HOMEPATH),
  process.env.USERPROFILE,
  '/tmp',
  '/temp'
].filter(fs.existsSync)[0]
