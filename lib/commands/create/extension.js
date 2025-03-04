import component from 'adapt-cli/lib/commands/create/component.js'
import { ADAPT_EXTENSION } from 'adapt-cli/lib/util/constants.js'

export default async function extension ({
  name,
  repository = ADAPT_EXTENSION,
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
