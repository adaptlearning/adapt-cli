import { adaptBuild } from '../integration/AdaptFramework.js'

export default async function build (logger, ...args) {
  // TODO: Process flags for dev, server, forceRebuild etc
  await adaptBuild({ logger })
}
