import fs from 'q-io/fs.js'

export default function (properties) {
  return fs.removeTree(properties.tmp)
    .then(function () {
      return properties
    })
}
