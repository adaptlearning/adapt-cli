import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import chalk from 'chalk'
import fetch from 'node-fetch'
import path from 'path'

export default async function search ({
  logger,
  searchTerm,
  cwd = process.cwd()
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  try {
    const uniqueResults = {}
    for (const serverURI of BOWER_REGISTRY_CONFIG.search) {
      try {
        const response = await fetch(`${serverURI}packages/search/${searchTerm}`, {
          method: 'GET',
          headers: { 'User-Agent': 'adapt-cli' },
          followRedirect: false
        })
        if (response.status !== 200) throw new Error(`The server responded with ${response.status}`)
        const immediateResults = await response.json()
        immediateResults?.forEach(result => (uniqueResults[result.name] = uniqueResults[result.name] ?? result))
      } catch (err) {}
    }
    const results = Object.values(uniqueResults)
    if (!results.length) {
      logger?.warn(`no plugins found containing: ${searchTerm}`)
    }
    results.forEach(function (result) {
      logger?.log(chalk.cyan(result.name) + ' ' + result.url)
    })
  } catch (err) {
    logger?.error("Oh dear, something went wrong. I'm terribly sorry.", err)
  }
}
