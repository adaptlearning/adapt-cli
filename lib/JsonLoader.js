import fs from 'fs'
import JSONLint from 'json-lint'

// eslint-disable-next-line node/no-deprecated-api
const exists = fs.exists

export default {
  existsSync: fs.existsSync,

  exists,

  readJSON: function (filepath, done) {
    done = done || function () {}

    fs.readFile(filepath, 'utf8', function (err, data) {
      if (err) return done(err)

      try {
        validateJSON(data, filepath)
        done(null, JSON.parse(data))
      } catch (ex) {
        done(ex.message)
      }
    })
  },

  readJSONSync: function (filepath) {
    const data = fs.readFileSync(filepath, 'utf-8')
    validateJSON(data, filepath)
    return JSON.parse(data)
  }
}

function validateJSON (jsonData, filepath) {
  const lint = JSONLint(jsonData)
  if (lint.error) {
    let errorMessage = 'JSON parsing error: ' + lint.error + ', line: ' + lint.line + ', character: ' + lint.character
    if (filepath) {
      errorMessage += ', file: \'' + filepath + '\''
    }
    throw new Error(errorMessage)
  }
}
