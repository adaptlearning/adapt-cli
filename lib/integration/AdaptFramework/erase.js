import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import globs from 'globs'
import path from 'path'

export default async function erase ({
  isInteractive = true,
  cwd,
  logger
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  if (!fs.existsSync(cwd)) return
  if (isInteractive) {
    const results = await inquirer.prompt([{
      name: 'overwrite existing course?',
      type: 'confirm',
      default: false
    }])
    if (!results['overwrite existing course?']) {
      throw new Error('Course already exists and cannot overwrite.')
    }
  }
  logger?.log(chalk.cyan('deleting existing course'))
  await fs.rm(cwd, { recursive: true })
}