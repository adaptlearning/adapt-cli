import {
  FRAMEWORK_REPOSITORY,
  FRAMEWORK_REPOSITORY_NAME,
  HOME_DIRECTORY
} from '../CONSTANTS.js'
import RepositoryDownloader from '../RepositoryDownloader.js'
import uuid from 'uuid'
import fs from 'q-io/fs.js'
import path from 'path'

export default function (properties) {
  const downloader = new RepositoryDownloader({
    repository: properties.repository || FRAMEWORK_REPOSITORY,
    branch: properties.branch
  })
  const tmp = properties.tmp = path.join(HOME_DIRECTORY, '.adapt', 'tmp', uuid.v1())

  return downloader.fetch(tmp)
    .then(function (fileName) {
      return fs.copyTree(getDownloadedSourcePath(properties, fileName), properties.localDir)
        .then(function () {
          return properties
        })
    })
}

function getDownloadedSourcePath (properties, fileName) {
  const fName = fileName ? fs.base(fileName, fs.extension(fileName)) : ((properties.repositoryName || FRAMEWORK_REPOSITORY_NAME) + '-' + properties.branch)
  return path.join(properties.tmp, fName)
}
