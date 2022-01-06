import chalk from 'chalk'
import {
  erase,
  download,
  npmInstall
} from '../../integration/AdaptFramework.js'
import path from 'path'
import { install as pluginsInstall } from '../../integration/PluginManagement.js'

export default async function course ({ name, branch, localDir, logger }) {
  localDir = path.join(localDir, name)
  await erase({ logger, localDir })
  await download({ logger, localDir, branch })
  await npmInstall({ logger, localDir })
  await pluginsInstall({ logger, localDir })
  logger?.log(`
${chalk.green(name)} has been created.

${chalk.grey('To build the course, run:')}
  cd ${name}
  grunt build

${chalk.grey('Then to view the course, run:')}
  grunt server
`)
}
