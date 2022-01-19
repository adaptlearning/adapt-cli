import fs from 'fs-extra'
import { findUpSync } from 'find-up'

export default function getBowerRegistryConfig (project) {
  function getConfig () {
    if (process.env.ADAPT_REGISTRY) {
      return process.env.ADAPT_REGISTRY
    }
    const configPath = findUpSync('.bowerrc')
    if (configPath) {
      // a manifest exists, load it
      const config = fs.readJSONSync(configPath)
      return config.registry
    }
    // use the default Adapt registry
    return 'http://adapt-bower-repository.herokuapp.com/'
  }
  // normalize to https://github.com/bower/spec/blob/master/config.md
  const config = getConfig()
  let normalized = {}
  switch (typeof config) {
    case 'string':
      normalized = {
        register: config,
        search: [config]
      }
      break
    case 'object':
      Object.assign(normalized, config)
      break
  }
  if (typeof normalized.search === 'string') normalized.search = [normalized.search].filter(Boolean)
  return normalized
}
