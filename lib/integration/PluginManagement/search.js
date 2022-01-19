import getBowerRegistryConfig from './getBowerRegistryConfig.js'
import Project from '../Project.js'
import chalk from 'chalk'
import request from 'request'

export default async function search ({
  logger,
  searchTerm
}) {
  const project = new Project({ logger })
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig(project)
  try {
    // TODO: go through all search urls
    const uniqueResults = {}
    for (const serverURI of BOWER_REGISTRY_CONFIG.search) {
      try {
        const immediateResults = await new Promise((resolve, reject) => {
          request({
            uri: `${serverURI}packages/search/${searchTerm}`,
            method: 'GET',
            headers: { 'User-Agent': 'adapt-cli' },
            followRedirect: false
          }, (err, res, body) => {
            if (err) return reject(err)
            if (res.statusCode !== 200) reject(new Error(`The server responded with ${res.statusCode}`))
            try {
              resolve(JSON.parse(body))
            } catch (err) {
              reject(err)
            }
          })
        })
        immediateResults?.forEach(result => (uniqueResults[result.name] = uniqueResults[result.name] ?? result))
      } catch (err) {}
    }
    const results = Object.values(uniqueResults)
    if (!results.length) {
      logger?.log(chalk.yellow(`no plugins found containing: ${searchTerm}`))
    }
    results.forEach(function (result) {
      logger?.log(chalk.cyan(result.name) + ' ' + result.url)
    })
  } catch (err) {
    logger?.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err)
  }
}
