import chalk from 'chalk'
import { exec } from 'child_process'
import { ADAPT_FRAMEWORK } from '../../util/constants.js'
import path from 'path'

export default async function clone ({
  repository = ADAPT_FRAMEWORK,
  branch = 'master',
  cwd = process.cwd(),
  logger
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  if (!branch && !repository) throw new Error('Repository details are required.')
  logger?.write(chalk.cyan('cloning framework to', cwd, '\t'))
  await new Promise(function (resolve, reject) {
    const child = exec(`git clone ${repository} "${cwd}"`)
    child.addListener('error', reject)
    child.addListener('exit', resolve)
  })
  await new Promise(function (resolve, reject) {
    const child = exec(`git checkout ${branch}`)
    child.addListener('error', reject)
    child.addListener('exit', resolve)
  })
  logger?.log(' ', 'done!')
}
