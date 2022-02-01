import chalk from 'chalk'
import { spawn } from 'child_process'
import Project from '../Project.js'

export default async function adaptBuild ({
  logger,
  noJSON = true,
  dev = false,
  forceRebuild = false,
  outputDir = null,
  cachePath = null,
  cwd = process.cwd()
} = {}) {
  const project = new Project({ cwd, logger })
  project.throwInvalid()
  logger?.log(chalk.cyan('running build'))
  await new Promise((resolve, reject) => {
    const npm = spawn((process.platform === 'win32' ? 'grunt.cmd' : 'grunt'), [
      noJSON && 'server-build',
      dev ? 'dev' : noJSON ? 'compile' : 'build',
      forceRebuild && '--disable-cache',
      outputDir && `--outputdir=${outputDir}`,
      cachePath && `--cachepath=${cachePath}`
    ].filter(Boolean), {
      stdio: 'inherit',
      cwd
    })
    npm.on('close', code => {
      if (code) return reject(new Error('grunt tasks failed'))
      resolve()
    })
  })
}
