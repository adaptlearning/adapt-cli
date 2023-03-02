import chalk from 'chalk'
import { exec } from 'child_process'
import path from 'path'

export async function install ({
  logger,
  cwd,
  args = []
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  await new Promise((resolve, reject) => {
    if (!args.length) logger?.log(chalk.cyan('installing node dependencies'))
    exec([(process.platform === 'win32' ? 'npm.cmd' : 'npm'), '--unsafe-perm', 'install', ...args].join(' '), {
      cwd
    }, (err, stdout, stderr) => {
      if (!err) return resolve()
      reject(stderr)
    })
  })
}

export async function update ({
  logger,
  cwd,
  args = []
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  await new Promise((resolve, reject) => {
    if (!args.length) logger?.log(chalk.cyan('installing node dependencies'))
    exec([(process.platform === 'win32' ? 'npm.cmd' : 'npm'), '--unsafe-perm', 'update', ...args].join(' '), {
      cwd
    }, (err, stdout, stderr) => {
      if (!err) return resolve()
      reject(stderr)
    })
  })
}

export async function uninstall ({
  logger,
  cwd,
  args = []
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  await new Promise((resolve, reject) => {
    if (!args.length) logger?.log(chalk.cyan('installing node dependencies'))
    exec([(process.platform === 'win32' ? 'npm.cmd' : 'npm'), '--unsafe-perm', 'uninstall', ...args].join(' '), {
      cwd
    }, (err, stdout, stderr) => {
      if (!err) return resolve()
      reject(stderr)
    })
  })
}
