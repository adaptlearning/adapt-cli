import { exec } from 'child_process'
import path from 'path'
import nodeFetch from 'node-fetch'
import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import semver from 'semver'

const pluginCache = {}
let isNPMCache = null

export async function isNPM ({ cwd = process.cwd() }) {
  if (isNPMCache !== null) return isNPMCache
  const packageName = 'adapt-contrib-core'
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  for (const url of BOWER_REGISTRY_CONFIG.search) {
    try {
      const pluginUrl = `${url}npm/${packageName}`
      const req = await nodeFetch(pluginUrl)
      const data = await req.json()
      isNPMCache = Boolean(typeof data === 'object' && data.name === packageName)
      return isNPMCache
    } catch (err) {
    }
  }
  return (isNPMCache = false)
}

export async function execute ({
  logger,
  command,
  cwd,
  args = []
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  await new Promise((resolve, reject) => {
    exec([(process.platform === 'win32' ? 'npm.cmd' : 'npm'), '--unsafe-perm', command, ...args].join(' '), {
      cwd
    }, (err, stdout, stderr) => {
      if (!err) return resolve()
      reject(stderr)
    })
  })
}

export async function install ({
  logger,
  cwd,
  args = []
} = {}) {
  await execute({ logger, command: 'install', cwd, args })
}

export async function update ({
  logger,
  cwd,
  args = []
} = {}) {
  await execute({ logger, command: 'update', cwd, args })
}

export async function uninstall ({
  logger,
  cwd,
  args = []
} = {}) {
  await execute({ logger, command: 'uninstall', cwd, args })
}

export async function fetchAllInfo ({
  logger,
  cwd,
  packageName
}) {
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  let json
  for (const url of BOWER_REGISTRY_CONFIG.search) {
    try {
      let data = pluginCache[packageName]
      if (!data) {
        const pluginUrl = `${url}npm/${packageName}`
        const req = await nodeFetch(pluginUrl)
        data = await req.json()
      }
      const versions = Object.values(data.versions).map(item => item.version)
      versions.sort((a, b) => semver.compare(a, b) * -1)
      json = {
        name: data.name,
        versions,
        latest: data.versions[data['dist-tags'].latest]
      }
    } catch (err) {
    }
  }
  return json
}

export async function fetchVersionInfo ({
  logger,
  cwd,
  packageName,
  version
}) {
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  for (const url of BOWER_REGISTRY_CONFIG.search) {
    try {
      let data = pluginCache[packageName]
      if (!data) {
        const pluginUrl = `${url}npm/${packageName}`
        const req = await nodeFetch(pluginUrl)
        data = await req.json()
      }
      return data.versions[version]
    } catch (err) {
    }
  }
  return []
}

export async function fetchRepoUrl ({
  logger,
  cwd,
  packageName,
  version
}) {
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  for (const url of BOWER_REGISTRY_CONFIG.search) {
    try {
      let data = pluginCache[packageName]
      if (!data) {
        const pluginUrl = `${url}npm/${packageName}`
        const req = await nodeFetch(pluginUrl)
        data = await req.json()
      }
      return data.repository?.url ?? data.repository
    } catch (err) {
    }
  }
  return null
}

export async function searchInfo ({
  logger,
  cwd,
  term
}) {
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  for (const url of BOWER_REGISTRY_CONFIG.search) {
    try {
      const pluginUrl = `${url}npm/-/v1/search?text=${term}&size=100`
      const req = await nodeFetch(pluginUrl)
      const data = await req.json()
      return data?.objects ?? []
    } catch (err) {
    }
  }
  return []
}
