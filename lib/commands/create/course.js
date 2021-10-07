import chalk from 'chalk'
import {
  deleteExistingCourse,
  downloadFrameworkBranchTo,
  npmInstall,
  adaptInstall
} from '../../integration/AdaptFramework.js'

export default async function course ({ localDir, branch, logger }) {
  await deleteExistingCourse({ logger, localDir })
  await downloadFrameworkBranchTo({ logger, localDir, branch })
  await npmInstall({ logger, localDir })
  await adaptInstall({ logger, localDir })
  logger?.log(`
${chalk.green(localDir)} has been created.

${chalk.grey('To build the course, run:')}
  cd ${localDir}
  grunt build

${chalk.grey('Then to view the course, run:')}
  grunt server
`)
}
