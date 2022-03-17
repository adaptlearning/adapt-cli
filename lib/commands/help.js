import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import getDirNameFromImportMeta from '../util/getDirNameFromImportMeta.js'
const __dirname = getDirNameFromImportMeta(import.meta)

export default function help (logger, ...args) {
  const name = args.join(' ')
  const json = name
    ? path.resolve(__dirname, `../../json/help-${name.replace(/\s+/g, '/')}.json`)
    : path.resolve(__dirname, '../../json/help.json')
  if (!fs.existsSync(json)) {
    logger?.log(`adapt ${chalk.red(name)}   Unknown command: ${name}`)
    return
  }
  const jsonData = fs.readJSONSync(json)
  logger?.log('\nUsage: \n')
  jsonData.usage.forEach(usage => logger?.log(`    ${chalk.cyan('adapt')} ${usage}`))
  if (jsonData.commands && Object.entries(jsonData.commands).length) {
    logger?.log('\n\nwhere <command> is one of:\n')
    Object.entries(jsonData.commands).forEach(([command, description]) => {
      logger?.log(`    ${command}${new Array(23 - command.length).join(' ')}${description}`)
    })
  }
  if (jsonData.description) {
    logger?.log(`\nDescription:\n\n    ${jsonData.description}`)
  }
  if (!name) {
    logger?.log('\nSee \'adapt help <command>\' for more information on a specific command.\n')
  }
}
