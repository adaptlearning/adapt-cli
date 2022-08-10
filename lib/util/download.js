import chalk from 'chalk'
import { v4 as uuid } from 'uuid'
import fs from 'fs-extra'
import path from 'path'
import urljoin from 'url-join'
import fetch from 'download'
import { HOME_DIRECTORY } from './constants.js'
import gh from 'parse-github-url'

export default async function download ({
  repository,
  branch,
  tmp,
  cwd,
  logger
} = {}) {
  if (!branch && !repository) throw new Error('Repository details are required.')
  const repositoryName = gh(repository).name
  logger?.write(chalk.cyan(`downloading ${repositoryName} to ${cwd}\t`))
  tmp = (tmp || path.join(HOME_DIRECTORY, '.adapt', 'tmp', uuid()))
  const downloadFileName = await new Promise((resolve, reject) => {
    let downloadFileName = ''
    const url = urljoin(repository, 'archive', branch + '.zip')
    fetch(url, tmp, {
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
    : `${repositoryName}-${branch}`
  const sourcePath = path.join(tmp, sourceFileName)
  await fs.copy(sourcePath, cwd)
  await fs.rm(tmp, { recursive: true })
  logger?.log(' ', 'done!')
}
