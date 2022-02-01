import chalk from 'chalk'
import {
  erase,
  download,
  npmInstall
} from '../../integration/AdaptFramework.js'
import path from 'path'
import { install as pluginsInstall } from '../../integration/PluginManagement.js'

export default async function course ({ name, branch, cwd, logger }) {
  cwd = path.join(cwd, name)
  await erase({ logger, cwd })
  await download({ logger, cwd, branch })
  await npmInstall({ logger, cwd })
  await pluginsInstall({ logger, cwd })
  logger?.log(`
${chalk.green(name)} has been created.

${chalk.grey('To build the course, run:')}
  cd ${name}
  grunt build

${chalk.grey('Then to view the course, run:')}
  grunt server
`)
}
