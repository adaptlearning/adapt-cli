import chalk from 'chalk'
import Project from '../integration/Project.js'
import { reportInvalidFrameworkDirectory } from '../util/RendererHelpers.js'

export default function ls (renderer) {
  const project = new Project()
  if (!project.isProjectContainsManifestFile()) {
    reportInvalidFrameworkDirectory(renderer)
    return
  }
  project.plugins.forEach(p => renderer.log(chalk.cyan(p.name), p.version))
}
