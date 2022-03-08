import chalk from 'chalk'
import { exec } from 'child_process'
import Project from '../Project.js'
import path from 'path'

export default async function adaptBuild ({
  sourceMaps = false,
  checkJSON = false,
  cache = true,
  sourceDir = null,
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
    exec([
      'npx grunt',
      !checkJSON
        ? `server-build:${sourceMaps ? 'dev' : 'prod'}` // AAT
        : `${sourceMaps ? 'diff' : 'build'}`, // Handbuilt
      !cache && '--disable-cache',
      sourceDir && `--sourcedir=${sourceDir}`,
      outputDir && `--outputdir=${outputDir}`,
      cachePath && `--cachepath=${cachePath}`
    ].filter(Boolean).join(' '), { cwd }, (error, stdout, stderr) => {
      if(error || stderr || stdout.startsWith('>> Error:')) {
        const e = new Error('grunt tasks failed')
        e.raw = error || stderr || stdout
        return reject(e)
      }
      resolve()
    })
  })
}
