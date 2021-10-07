import chalk from 'chalk'
import { exec } from 'child_process'
import { FRAMEWORK_REPOSITORY } from './constants.js'

export default async function cloneFrameworkBranchTo ({
  repository = FRAMEWORK_REPOSITORY,
  branch = 'master',
  localDir,
  logger
} = {}) {
  if (!branch && !repository) throw new Error('Repository details are required.')
  logger?.write(chalk.cyan('cloning framework to', localDir, '\t'))
  await new Promise(function (resolve, reject) {
    const child = exec(`git clone ${repository} "${localDir}"`)
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
