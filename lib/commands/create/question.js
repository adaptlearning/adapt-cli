import component from './component.js'
import { ADAPT_QUESTION, ADAPT_QUESTION__NAME } from '../../util/constants.js'

export default async function question ({
  name,
  repository = ADAPT_QUESTION,
  repositoryName = ADAPT_QUESTION__NAME,
  localDir,
  branch,
  logger
}) {
  return component({
    name,
    repository,
    repositoryName,
    localDir,
    branch,
    logger
  })
}
