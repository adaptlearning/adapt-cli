import chalk from 'chalk'
import uuid from 'uuid'
import fs from 'fs-extra'
import path from 'path'
import urljoin from 'url-join'
import download from 'download'
import { exec } from 'child_process'
// check adapt version for switching bower and npm style modules

export const HOME_DIRECTORY = (function getHomeDirectory () {
  const locations = [
    process.env.HOME,
    (process.env.HOMEDRIVE + process.env.HOMEPATH),
    process.env.USERPROFILE,
    '/tmp',
    '/temp'
  ]
  const validLocations = locations.filter(fs.existsSync)
  return validLocations[0]
})()

export const FRAMEWORK_REPOSITORY_NAME = 'adapt_framework'
export const FRAMEWORK_REPOSITORY = process.env.ADAPT_FRAMEWORK || `https://github.com/adaptlearning/${FRAMEWORK_REPOSITORY_NAME}`

export async function cloneFrameworkBranchTo ({
  repository = FRAMEWORK_REPOSITORY,
  repositoryName,
  branch = 'master',
  tmp,
  localDir,
  renderer
} = {}) {
  if (!branch && !repository) throw new Error('Repository details are required.')
  renderer?.write(chalk.cyan('cloning framework to', localDir, '\t'))
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
  renderer?.log(' ', 'done!')
}

export async function downloadFrameworkBranchTo ({
  repository = FRAMEWORK_REPOSITORY,
  repositoryName,
  branch,
  tmp,
  localDir,
  renderer
} = {}) {
  if (!branch && !repository) throw new Error('Repository details are required.')
  renderer?.write(chalk.cyan('downloading framework to', localDir, '\t'))
  tmp = (tmp || path.join(HOME_DIRECTORY, '.adapt', 'tmp', uuid.v1()))
  const downloadFileName = await new Promise((resolve, reject) => {
    let downloadFileName = ''
    const url = urljoin(repository, 'archive', branch + '.zip')
    download(url, tmp, {
      extract: true
    })
      .on('response', response => {
        const disposition = response.headers['content-disposition']
        if (disposition?.indexOf('attachment') === -1) return
        const regex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        const matches = regex.exec(disposition)
        if (!matches?.[1]) return
        downloadFileName = matches[1].replace(/['"]/g, '')
      })
      .on('error', reject)
      .then(() => resolve(downloadFileName))
  })
  const sourceFileName = downloadFileName
    ? path.parse(downloadFileName).name
    : `${repositoryName || FRAMEWORK_REPOSITORY_NAME}-${branch}`
  const sourcePath = path.join(tmp, sourceFileName)
  await fs.copy(sourcePath, localDir)
  await fs.rm(tmp, { recursive: true })
  renderer?.log(' ', 'done!')
}
