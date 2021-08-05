import fs from 'fs'

// eslint-disable-next-line node/no-deprecated-api
const exists = fs.exists

export default {
  existsSync: fs.existsSync,

  exists,

  writeJSON: function (filepath, values, done) {
    done = done || function () {}

    fs.writeFile(filepath, JSON.stringify(values, null, 4), { encoding: 'utf8' }, function (err) {
      if (err) return done(err)

      done()
    })
  },

  writeJSONSync: function (filepath, values) {
    return fs.writeFileSync(filepath, JSON.stringify(values, null, 4), { encoding: 'utf8' })
  }
}
