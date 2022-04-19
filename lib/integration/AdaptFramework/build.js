import chalk from 'chalk'
import { exec } from 'child_process'
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
    const cmd = [
      'npx grunt',
      !checkJSON
        ? `server-build:${sourceMaps ? 'dev' : 'prod'}` // AAT
        : `${sourceMaps ? 'diff' : 'build'}`, // Handbuilt
      !cache && '--disable-cache',
      outputDir && `--outputdir=${outputDir}`,
      cachePath && `--cachepath=${cachePath}`
    ].filter(Boolean).join(' ');
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if(error || stderr) {
        const e = new Error('grunt tasks failed')
        e.cmd = cmd
        const match = stdout.match(/>> Error:\s(.+)\s/)
        e.raw = match ? match[1][0] : stderr
        return reject(e)
      }
      resolve()
    })
  })
}
