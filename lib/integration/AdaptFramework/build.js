import chalk from 'chalk'
import { spawn } from 'child_process'
import Project from '../Project.js'

export default async function adaptBuild ({
  sourceMaps,
  noJSONChecks,
  noCache,
  outputDir = null,
  cachePath = null,
  cwd = process.cwd(),
  logger
} = {}) {
  const project = new Project({ cwd, logger })
  project.tryThrowInvalidPath()
  logger?.log(chalk.cyan('running build'))
  await new Promise((resolve, reject) => {
    const npm = spawn((process.platform === 'win32' ? 'grunt.cmd' : 'grunt'), [
      noJSONChecks && 'server-build',
      sourceMaps ? 'dev' : noJSONChecks ? 'compile' : 'build',
      noCache && '--disable-cache',
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
