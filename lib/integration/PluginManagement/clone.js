import fs from 'fs-extra'
import path from 'path'
import gitClone from '../../util/gitClone.js'

/**
 * Clone a plugin from a git URL and write .bower.json metadata
 * @param {Object} options
 * @param {string} options.url The git repository URL
 * @param {string} options.destPath The target directory for the plugin
 * @param {string} [options.branch] Optional branch, tag, or ref
 * @returns {Object} The bower.json contents (with git metadata)
 */
export default async function clonePlugin ({
  url,
  destPath,
  branch = null
} = {}) {
  await fs.ensureDir(path.dirname(destPath))
  await fs.rm(destPath, { recursive: true, force: true })
  await gitClone({ url, dir: destPath, branch })
  const bowerJSON = await fs.readJSON(path.join(destPath, 'bower.json'))
  bowerJSON._gitUrl = url
  bowerJSON._gitRef = branch || undefined
  bowerJSON._wasInstalledFromGitRepo = true
  await fs.writeJSON(path.join(destPath, '.bower.json'), bowerJSON, { spaces: 2, replacer: null })
  return bowerJSON
}
