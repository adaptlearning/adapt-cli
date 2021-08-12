import Project from '../integration/Project.js'
import path from 'path'
import { readValidateJSONSync } from '../util/JSONReadValidate.js'
import getDirNameFromImportMeta from '../util/getDirNameFromImportMeta.js'
const __dirname = getDirNameFromImportMeta(import.meta)

export default function version (renderer) {
  const versionPath = path.join(__dirname, '../../package.json')
  const version = readValidateJSONSync(versionPath).version
  const project = new Project()
  renderer.log('CLI: ' + version)
  renderer.log('Framework: ' + project.getFrameworkVersion())
}
