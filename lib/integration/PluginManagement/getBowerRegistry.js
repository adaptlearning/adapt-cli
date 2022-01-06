import fs from 'fs-extra'
import path from 'path'

export default function getBowerRegistry (project) {
  if (process.env.ADAPT_REGISTRY) {
    return process.env.ADAPT_REGISTRY
  }
  if (fs.existsSync(path.resolve(project.localDir, './.bowerrc'))) {
  // a manifest exists; let bower determine the registry
    return null
  }
  // use the default Adapt registry
  return 'http://adapt-bower-repository.herokuapp.com/'
}
