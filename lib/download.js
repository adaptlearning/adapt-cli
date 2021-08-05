'use strict'

import decompress from 'decompress'
import eachAsync from 'each-async'
import fs from 'fs'
import mkdir from 'mkdirp'
import path from 'path'
import request from 'request'
import through from 'through2'

/**
 * Download a file to a given destination
 *
 * Options:
 *
 *   - `extract` Try extracting the file
 *   - `mode` Set mode on the downloaded files
 *   - `strip` Equivalent to --strip-components for tar
 *
 * @param {String|Array|Object} url
 * @param {String} dest
 * @param {Object} opts
 * @api public
 */

export default function (url, dest, opts) {
  url = Array.isArray(url) ? url : [url]
  opts = opts || {}

  const stream = through()
  const strip = opts.strip || '0'
  let target

  eachAsync(url, function (url, index, done) {
    opts.url = url
    target = path.join(dest, path.basename(url))

    if (url.url && url.name) {
      target = path.join(dest, url.name)
      opts.url = url.url
    }

    const req = request.get(opts)
      .on('response', function (res) {
        stream.emit('response', res)
      })
      .on('data', function (data) {
        stream.emit('data', data)
      })
      .on('error', function (err) {
        stream.emit('error', err)
      })

    req.on('response', function (res) {
      const mime = res.headers['content-type']
      const status = res.statusCode
      let end

      if (status < 200 || status >= 300) {
        stream.emit('error', status)
        return
      }

      if (opts.extract && decompress.canExtract(url, mime)) {
        let ext

        if (decompress.canExtract(url)) {
          ext = url
        } else {
          ext = mime
        }

        end = decompress.extract({
          ext: ext,
          path: dest,
          strip: strip
        })
      } else {
        if (!fs.existsSync(dest)) {
          mkdir.sync(dest)
        }

        end = fs.createWriteStream(target)
      }

      req.pipe(end)

      end.on('close', function () {
        if (!opts.extract && opts.mode) {
          fs.chmodSync(target, opts.mode)
        }

        done()
      })
    })
  }, function () {
    stream.emit('close')
  })

  return stream
}
