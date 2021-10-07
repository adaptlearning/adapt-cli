import chalk from 'chalk'
import uuid from 'uuid'
import fs from 'fs-extra'
import path from 'path'
import urljoin from 'url-join'
import download from 'download'
import { FRAMEWORK_REPOSITORY, HOME_DIRECTORY, FRAMEWORK_REPOSITORY_NAME } from './constants.js'

export default async function downloadFrameworkBranchTo ({
  repository = FRAMEWORK_REPOSITORY,
  repositoryName,
  branch,
  tmp,
  localDir,
  logger
} = {}) {
  if (!branch && !repository) throw new Error('Repository details are required.')
  logger?.write(chalk.cyan('downloading framework to', localDir, '\t'))
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
  logger?.log(' ', 'done!')
}
