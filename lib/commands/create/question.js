import component from './component.js'
import { ADAPT_QUESTION } from '../../util/constants.js'

export default async function question ({
  name,
  repository = ADAPT_QUESTION,
  cwd,
  branch,
  logger
}) {
  return component({
    name,
    repository,
    cwd,
    branch,
    logger
  })
}
