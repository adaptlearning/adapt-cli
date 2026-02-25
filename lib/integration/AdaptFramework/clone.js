import chalk from 'chalk'
import { ADAPT_FRAMEWORK } from '../../util/constants.js'
import path from 'path'
import gitClone from '../../util/gitClone.js'

export default async function clone ({
  repository = ADAPT_FRAMEWORK,
  branch = 'master',
  cwd = process.cwd(),
  logger
} = {}) {
  repository = repository.replace(/\.git/g, '')
  cwd = path.resolve(process.cwd(), cwd)
  if (!branch && !repository) throw new Error('Repository details are required.')
  logger?.write(chalk.cyan('cloning framework to', cwd, '\t'))
  await gitClone({ url: repository, dir: cwd, branch })
  logger?.log(' ', 'done!')
}
