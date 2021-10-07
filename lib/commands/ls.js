import chalk from 'chalk'
import Project from '../integration/Project.js'
import { reportInvalidFrameworkDirectory } from '../util/RendererHelpers.js'

export default function ls (logger) {
  const project = new Project()
  if (!project.containsManifestFile) return reportInvalidFrameworkDirectory(logger)
  project.plugins.forEach(p => logger?.log(`${chalk.cyan(p.name)} ${p.version}`))
}
