import chalk from 'chalk'
import { spawn } from 'child_process'
import path from 'path'

export default async function npmInstall ({
  logger,
  cwd,
  args = []
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  await new Promise((resolve, reject) => {
    if (!args.length) logger?.log(chalk.cyan('installing node dependencies'))
    const npm = spawn((process.platform === 'win32' ? 'npm.cmd' : 'npm'), ['--unsafe-perm', 'install', ...args], {
      stdio: 'inherit',
      cwd
    })
    npm.on('close', code => {
      if (code) return reject(new Error('npm install failed'))
      resolve()
    })
  })
}
