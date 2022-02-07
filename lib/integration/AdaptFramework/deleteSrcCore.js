import fs from 'fs-extra'
import path from 'path'

export default function deleteSrcCore ({
  cwd = process.cwd()
} = {}) {
  return fs.rm(path.resolve(cwd, 'src/core'), { recursive: true, force: true })
}
