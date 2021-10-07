import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'

export default async function deleteExistingCourse ({
  logger,
  localDir
} = {}) {
  if (!fs.existsSync(localDir)) return
  const results = await inquirer.prompt([{
    name: 'overwrite existing course?',
    type: 'confirm',
    default: false
  }])
  if (!results['overwrite existing course?']) {
    throw new Error('Course already exists and cannot overwrite.')
  }
  logger?.log(chalk.cyan('deleting existing course'))
  await fs.rm(localDir, { recursive: true })
}
