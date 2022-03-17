import chalk from 'chalk'
import Project from '../integration/Project.js'

export default async function ls (logger) {
  const project = new Project({ logger })
  project.tryThrowInvalidPath()
  const installTargets = await project.getInstallTargets()
  installTargets.forEach(p => logger?.log(`${chalk.cyan(p.name || p.sourcePath)} ${p.sourcePath || p.requestedVersion}`))
}
