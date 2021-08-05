import {
  DEFAULT_PROJECT_MANIFEST_PATH,
  DEFAULT_PROJECT_FRAMEWORK_PATH
} from '../CONSTANTS.js'
import Project from '../Project.js'
import path from 'path'
import JsonLoader from '../JsonLoader.js'
import importMetaToDirName from '../importMetaToDirName.js'
const __dirname = importMetaToDirName(import.meta)

export default function version (renderer) {
  const versionPath = path.join(__dirname, '../../package.json')
  const version = JsonLoader.readJSONSync(versionPath).version
  const project = new Project(DEFAULT_PROJECT_MANIFEST_PATH(), DEFAULT_PROJECT_FRAMEWORK_PATH())
  renderer.log('CLI: ' + version)
  renderer.log('Framework: ' + project.getFrameworkVersion())
}
