import { exec } from 'child_process'
import path from 'path'

export async function execute ({
  logger,
  command,
  cwd,
  args = []
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  await new Promise((resolve, reject) => {
    exec([(process.platform === 'win32' ? 'npm.cmd' : 'npm'), '--unsafe-perm', command, ...args].join(' '), {
      cwd
    }, (err, stdout, stderr) => {
      if (!err) return resolve()
      reject(stderr)
    })
  })
}

export async function install ({
  logger,
  cwd,
  args = []
} = {}) {
  await execute({ logger, command: 'install', cwd, args })
}

export async function update ({
  logger,
  cwd,
  args = []
} = {}) {
  await execute({ logger, command: 'update', cwd, args })
}

export async function uninstall ({
  logger,
  cwd,
  args = []
} = {}) {
  await execute({ logger, command: 'uninstall', cwd, args })
}
