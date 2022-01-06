import chalk from 'chalk'
import Project from '../integration/Project.js'

export default async function ls (logger) {
  const project = new Project({ logger })
  project.throwInvalid()
  project.plugins.forEach(p => logger?.log(`${chalk.cyan(p.name)} ${p.version}`))
}
