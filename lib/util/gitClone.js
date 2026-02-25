import { exec } from 'child_process'

/**
 * Clone a git repository
 * @param {Object} options
 * @param {string} options.url The repository URL
 * @param {string} options.dir The target directory
 * @param {string} [options.branch] Optional branch, tag, or ref to clone
 * @param {boolean} [options.shallow=false] Whether to use --depth 1
 */
export default async function gitClone ({
  url,
  dir,
  branch = null,
  shallow = false
} = {}) {
  const flags = [
    shallow && '--depth 1',
    branch && `--branch ${branch}`
  ].filter(Boolean).join(' ')
  const cmd = `git clone${flags ? ' ' + flags : ''} ${url} "${dir}"`
  await new Promise((resolve, reject) => {
    exec(cmd, (err) => {
      if (err) return reject(err)
      resolve()
    })
  })
}
