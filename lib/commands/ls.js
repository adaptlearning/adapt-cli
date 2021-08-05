import {
  DEFAULT_PROJECT_MANIFEST_PATH
} from '../CONSTANTS.js'
import chalk from 'chalk'
import Project from '../Project.js'
import { reportInvalidFrameworkDirectory } from '../RendererHelpers.js'

export default function ls (renderer) {
  const project = new Project(DEFAULT_PROJECT_MANIFEST_PATH())
  const done = arguments[arguments.length - 1]

  if (project.isProjectContainsManifestFile()) {
    project.plugins.forEach(function (p) {
      renderer.log(chalk.cyan(p.name), p.version)
    })
    done()
  } else {
    reportInvalidFrameworkDirectory(renderer)
  }
}
