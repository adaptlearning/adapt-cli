import fs from 'fs-extra'

export const ADAPT_FRAMEWORK_NAME = process.env.ADAPT_FRAMEWORK_NAME || 'adapt_framework'

export const ADAPT_FRAMEWORK = process.env.ADAPT_FRAMEWORK || `https://github.com/adaptlearning/${ADAPT_FRAMEWORK_NAME}`

export const ADAPT_DEFAULT_USER_AGENT = process.env.ADAPT_DEFAULT_USER_AGENT || 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'

export const HOME_DIRECTORY = [
  process.env.HOME,
  (process.env.HOMEDRIVE + process.env.HOMEPATH),
  process.env.USERPROFILE,
  '/tmp',
  '/temp'
].filter(fs.existsSync)[0]

export const ADAPT_COMPONENT_NAME = process.env.ADAPT_COMPONENT_NAME || 'adapt-component'

export const ADAPT_COMPONENT = process.env.ADAPT_COMPONENT || `https://github.com/adaptlearning/${ADAPT_COMPONENT_NAME}`

export const ADAPT_QUESTION__NAME = process.env.ADAPT_QUESTION__NAME || 'adapt-questionComponent'

export const ADAPT_QUESTION = process.env.ADAPT_QUESTION || `https://github.com/adaptlearning/${ADAPT_QUESTION__NAME}`
