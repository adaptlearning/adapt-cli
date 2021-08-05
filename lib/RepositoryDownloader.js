import urljoin from 'url-join'
import download from 'download'

export default class RespositoryDownloader {
  constructor (options) {
    if (!options.branch && !options.repository) { throw new Error('Repository details are required.') }
    this.options = options
  }

  get url () {
    return urljoin(this.options.repository, 'archive', this.options.branch + '.zip')
  }

  fetch (destination) {
    return new Promise((resolve, reject) => {
      // let previousPercent = 0
      let fileName = ''

      download(this.url, destination, {
        extract: true
      })
        .on('response', response => {
          fileName = this.getFileName(response.headers['content-disposition'])
        })
        // TODO: don't think this is used
        // .on('downloadProgress', function (progress) {
        //   const state = {
        //     receivedSize: progress.transferred,
        //     percent: Math.round(progress.transferred / progress.total * 100)
        //   }

        //   if (state.percent > previousPercent) {
        //     previousPercent = state.percent
        //     deferred.notify(state, progress)
        //   }
        // })
        .on('error', reject)
        .then(() => {
          resolve(fileName)
        })
    })
  }

  getFileName (disposition) {
    let fileName = ''
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const regex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      const matches = regex.exec(disposition)
      if (matches != null && matches[1]) {
        fileName = matches[1].replace(/['"]/g, '')
      }
    }
    return fileName
  }
}
