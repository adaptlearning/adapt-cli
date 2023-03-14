import nodeFetch from 'node-fetch'
import getBowerRegistryConfig from '../getBowerRegistryConfig.js'

export async function searchInfo ({
  logger,
  cwd,
  term
}) {
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  for (const url of BOWER_REGISTRY_CONFIG.search) {
    try {
      const pluginUrl = `${url}packages/search/${term}`
      const req = await nodeFetch(pluginUrl)
      const data = await req.json()
      return data ?? []
    } catch (err) {
    }
  }
  return []
}
