import fs from 'fs-extra'
import path from 'path'

export default function deleteSrcCourse ({
  cwd = process.cwd()
} = {}) {
  return fs.rm(path.resolve(cwd, 'src/course'), { recursive: true, force: true })
}
