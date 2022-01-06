import downloader from '../../util/download.js'
import { ADAPT_FRAMEWORK, ADAPT_FRAMEWORK_NAME } from '../../util/constants.js'

export default async function download ({
  repository = ADAPT_FRAMEWORK,
  repositoryName = ADAPT_FRAMEWORK_NAME,
  branch,
  tmp,
  localDir,
  logger
} = {}) {
  return downloader({
    repository,
    repositoryName,
    branch,
    tmp,
    localDir,
    logger
  })
}
