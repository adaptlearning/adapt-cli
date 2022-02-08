import chalk from 'chalk'
import { spawn } from 'child_process'
import Project from '../Project.js'
import path from 'path'

export default async function adaptBuild ({
  sourceMaps = false,
  checkJSON = false,
  cache = true,
  outputDir = null,
  cachePath = null,
  cwd = process.cwd(),
  logger
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const project = new Project({ cwd, logger })
  project.tryThrowInvalidPath()
  logger?.log(chalk.cyan('running build'))
  await new Promise((resolve, reject) => {
    const npm = spawn((process.platform === 'win32' ? 'grunt.cmd' : 'grunt'), [
      !checkJSON
        ? `server-build:${sourceMaps ? 'dev' : 'prod'}` // AAT
        : `${sourceMaps ? 'diff' : 'build'}`, // Handbuilt
      !cache && '--disable-cache',
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
