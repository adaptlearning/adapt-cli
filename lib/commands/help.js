import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import importMetaToDirName from '../importMetaToDirName.js'
const __dirname = importMetaToDirName(import.meta)

export default function help (renderer) {
  const name = arguments.length >= 3
    ? arguments.length > 3
      ? Array.prototype.slice.apply(arguments, [1, arguments.length - 1]).join(' ')
      : arguments[1]
    : ''
  let json

  if (name) {
    json = path.resolve(__dirname, '../../json/help-' + name.replace(/\s+/g, '/') + '.json')
  } else {
    json = path.resolve(__dirname, '../../json/help.json')
  }

  // eslint-disable-next-line node/no-deprecated-api
  fs.exists(json, function (exists) {
    if (!exists) {
      renderer.log('adapt ' + chalk.red(name) + '   Unknown command: ' + name)
    } else {
      const jsonData = fs.readJSONSync(json)

      renderer.log('\nUsage: \n')
      jsonData.usage.forEach(usage => {
        renderer.log('    ' + chalk.cyan('adapt') + ' ' + usage)
      })

      if (!Object.entries(jsonData.commands).length) {
        renderer.log('\n\nwhere <command> is one of:\n')
        Object.entries(jsonData.commands).forEach(([command, description]) => {
          renderer.log('    ' + command + new Array(23 - command.length).join(' ') + description)
        })
      }

      if (jsonData.description) {
        renderer.log('\nDescription:\n\n    ' + jsonData.description)
      }

      if (!name) {
        renderer.log('\nSee \'adapt help <command>\' for more information on a specific command.\n')
      }
    }
  })
}
