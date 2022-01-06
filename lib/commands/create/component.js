import fs from 'fs-extra'
import globs from 'globs'
import path from 'path'
import chalk from 'chalk'
import slug from 'speakingurl'
import Project from '../../integration/Project.js'
import downloader from '../../util/download.js'
import { ADAPT_COMPONENT, ADAPT_COMPONENT_NAME } from '../../util/constants.js'

export default async function component ({
  name,
  repository = ADAPT_COMPONENT,
  repositoryName = ADAPT_COMPONENT_NAME,
  localDir,
  branch,
  logger
}) {
  name = slug(name, { maintainCase: true })

  const project = new Project({ localDir, logger })
  let pluginDir
  if (project.containsManifestFile) {
    const componentsDirectory = 'src/components'
    pluginDir = path.join(localDir, componentsDirectory, 'adapt-' + name)
    if (!fs.existsSync(componentsDirectory)) fs.mkdirSync(componentsDirectory)
  } else {
    pluginDir = path.join(localDir, name)
  }

  await downloader({
    branch,
    repository,
    repositoryName,
    localDir: pluginDir,
    logger
  })

  const files = await new Promise((resolve, reject) => {
    globs('**', { cwd: pluginDir }, (err, matches) => {
      if (err) return reject(err)
      resolve(matches.map(match => path.join(pluginDir, match)))
    })
  })

  const filesRenamed = files.map(from => {
    const to = from.replace(/((contrib-)?componentName)/g, name)
    fs.renameSync(from, to)
    return to
  })

  await Promise.all(filesRenamed.map(async function (file) {
    if (fs.statSync(file).isDirectory()) return
    const lowerCaseName = name.toLowerCase()
    const content = (await fs.readFile(file)).toString()
    const modifiedContent = content
      .replace(/((contrib-)?componentName)/g, name)
      .replace(/((contrib-)?componentname)/g, lowerCaseName)
    return fs.writeFile(file, modifiedContent)
  }))

  logger?.log('\n' + chalk.green(pluginDir), 'has been created.\n')

  if (fs.existsSync('./adapt.json')) {
    logger?.log(chalk.grey('To use this component in your course, use the registered name:') + chalk.yellow(name))
  }
}
