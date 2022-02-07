import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import globs from 'globs'

export default async function erase ({
  isInteractive = true,
  cwd,
  logger
} = {}) {
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
  const files = await new Promise((resolve, reject) => {
    globs('**', { cwd }, (err, files) => {
      if (err) return reject(err)
      resolve(files)
    })
  })
  for (const file of files) {
    await fs.rm(file, { recursive: true })
  }
}
