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
        // Surface the salient failure rather than the whole grunt transcript:
        // a '>> Error:' task message, else a bare 'Error:' line (e.g. a rollup
        // load failure from the javascript task), else the failing-task warning.
        // Fall back to the full stdout only when none of those are present.
        const matches = stdout.match(/>> Error:\s(.+)/) ||
          stdout.match(/^Error:\s(.+)/m) ||
          stdout.match(/(Warning: Task .+ failed)/);
        const e = new Error('grunt tasks failed')
        e.cmd = cmd;
        e.raw = matches?.[1] ?? stdout;
        e.stdout = stdout;
        e.source = error;
        e.stderr = stderr;
        return reject(e)
      }
      resolve()
    })
  })
}
