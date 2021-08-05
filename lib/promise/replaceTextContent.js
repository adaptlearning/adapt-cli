import fs from 'q-io/fs.js'

export default function (path, match, replacement) {
  return fs.read(path)
    .then(function (content) {
      const modifiedContent = content.replace(match, replacement)
      return fs.write(path, modifiedContent)
    })
}
