import downloader from '../../util/download.js'
import { ADAPT_FRAMEWORK } from '../../util/constants.js'

export default async function download ({
  repository = ADAPT_FRAMEWORK,
  branch,
  tmp,
  cwd,
  logger
} = {}) {
  return downloader({
    repository,
    branch,
    tmp,
    cwd,
    logger
  })
}
