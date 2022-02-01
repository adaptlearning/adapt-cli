import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'

export default async function erase ({
  logger,
  cwd
} = {}) {
  if (!fs.existsSync(cwd)) return
  const results = await inquirer.prompt([{
    name: 'overwrite existing course?',
    type: 'confirm',
    default: false
  }])
  if (!results['overwrite existing course?']) {
    throw new Error('Course already exists and cannot overwrite.')
  }
  logger?.log(chalk.cyan('deleting existing course'))
  await fs.rm(cwd, { recursive: true })
}
