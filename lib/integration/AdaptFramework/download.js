import downloader from '../../util/download.js'
import { ADAPT_FRAMEWORK } from '../../util/constants.js'
import path from 'path'

export default async function download ({
  repository = ADAPT_FRAMEWORK,
  branch,
  tmp,
  cwd,
  logger
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  return downloader({
    repository,
    branch,
    tmp,
    cwd,
    logger
  })
}
