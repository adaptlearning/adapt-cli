import Project from '../integration/Project.js'
import path from 'path'
import { readValidateJSONSync } from '../util/JSONReadValidate.js'
import getDirNameFromImportMeta from '../util/getDirNameFromImportMeta.js'
const __dirname = getDirNameFromImportMeta(import.meta)

export default function version (logger) {
  const cliVersionPath = path.join(__dirname, '../../package.json')
  const cliVersion = readValidateJSONSync(cliVersionPath).version
  const project = new Project()
  logger?.log('CLI: ' + cliVersion)
  logger?.log('Framework: ' + project.version)
}
