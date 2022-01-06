import chalk from 'chalk'
import { spawn } from 'child_process'
import Project from '../Project.js'

export default async function adaptBuild ({
  logger,
  dev = false,
  server = false,
  forceRebuild = false
} = {}) {
  // TODO: Process flags for dev, server, forceRebuild etc
  const localDir = process.cwd()
  const project = new Project({ localDir, logger })
  project.throwInvalid()
  logger?.log(chalk.cyan('running build'))
  await new Promise((resolve, reject) => {
    const npm = spawn((process.platform === 'win32' ? 'grunt.cmd' : 'grunt'), [
      dev ? 'dev' : 'build',
      forceRebuild && '--disable-cache'
    ].filter(Boolean), {
      stdio: 'inherit',
      cwd: localDir
    })
    npm.on('close', code => {
      if (code) return reject(new Error('grunt tasks failed'))
      resolve()
    })
  })
}
