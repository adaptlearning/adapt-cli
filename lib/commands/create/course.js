import chalk from 'chalk'
import inquirer from 'inquirer'
import fs from 'fs-extra'
import install from '../install.js'
import { downloadFrameworkBranchTo } from '../../integration/AdaptFramework.js'
import { spawn } from 'child_process'

export default async function course (properties) {
  await deleteExistingCourse(properties)
  await downloadFrameworkBranchTo(properties)
  await npmInstall(properties)
  await adaptInstall(properties)
  properties.renderer.log(`
${chalk.green(properties.localDir)} has been created.

${chalk.grey('To build the course, run:')}
  cd ${properties.localDir}
  grunt build

${chalk.grey('Then to view the course, run:')}
  grunt server
`)
}

async function deleteExistingCourse (properties) {
  if (!fs.existsSync(properties.localDir)) return
  const results = await inquirer.prompt([
    {
      name: 'overwrite existing course?',
      type: 'confirm',
      default: false
    }
  ])
  if (!results['overwrite existing course?']) {
    throw new Error('Course already exists and cannot overwrite.')
  }
  await fs.rm(properties.localDir, { recursive: true })
}

async function npmInstall (properties) {
  await new Promise((resolve, reject) => {
    properties.renderer.log(chalk.cyan('installing node dependencies'))
    const npm = spawn((process.platform === 'win32' ? 'npm.cmd' : 'npm'), ['--unsafe-perm', 'install'], {
      stdio: 'inherit',
      cwd: properties.localDir
    })
    npm.on('close', code => {
      if (code) return reject(new Error('npm install failed'))
      resolve(properties)
    })
  })
}

async function adaptInstall (properties) {
  const startCwd = process.cwd()
  process.chdir(properties.localDir)
  console.log(startCwd, 'change to', process.cwd())
  properties.renderer.log(chalk.cyan('installing adapt dependencies'))
  await install(properties.renderer)
  process.chdir(startCwd)
}
