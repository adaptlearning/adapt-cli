import { v4 as uuid } from 'uuid'
import path from 'path'
import decompress from 'decompress'
import { HOME_DIRECTORY } from './constants.js'

export default async function extract ({
  sourcePath,
  cwd
} = {}) {
  const rootPath = path.join(HOME_DIRECTORY, '.adapt', 'tmp', uuid()).replace(/\\/g, '/')
  const files = await decompress(path.join(cwd, sourcePath), rootPath, {
    filter: file => !file.path.endsWith('/')
  })
  const rootDirectories = Object.keys(files.reduce((memo, file) => { memo[file.path.split(/\\|\//g)[0]] = true; return memo }, {}))
  let copyPath = rootPath
  if (rootDirectories.length === 1) {
    const rootDirectory = files[0].path.split(/\\|\//g)[0]
    copyPath = path.join(rootPath, rootDirectory)
  }
  return {
    rootPath,
    copyPath
  }
}
