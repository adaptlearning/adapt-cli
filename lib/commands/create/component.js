import fs from 'fs-extra'
import path from 'path'
import chalk from 'chalk'
import slug from 'speakingurl'
import { downloadFrameworkBranchTo } from '../../integration/AdaptFramework.js'

export const COMPONENT_REPOSITORY_NAME = 'adapt-component'
export const COMPONENT_REPOSITORY = process.env.ADAPT_COMPONENT || `https://github.com/adaptlearning/${COMPONENT_REPOSITORY_NAME}`

export default function component (properties) {
  properties.component = {
    name: slug(properties.localDir, { maintainCase: true }),
    files: []
  }
  properties.relative = function (file) {
    return path.join(properties.localDir, file)
  }

  if (addComponentToCurrentCourse()) {
    const componentsDirectory = 'src/components'
    properties.localDir = path.join(componentsDirectory, properties.localDir)
    if (!fs.existsSync(componentsDirectory)) fs.mkdirSync(componentsDirectory)
  }
  properties.component.files.push(properties.relative('bower.json'))

  return createComponent(properties)
    .then(function (properties) {
      properties.renderer.log('\n' + chalk.green(properties.localDir), 'has been created.\n')

      if (addComponentToCurrentCourse()) {
        properties.renderer.log(chalk.grey('To use this component in your course, use the registered name:') + chalk.yellow(properties.component.name))
      }
    })
}

function addComponentToCurrentCourse () {
  return fs.existsSync('./adapt.json')
}

function createComponent (properties) {
  properties.repository = COMPONENT_REPOSITORY
  properties.repositoryName = COMPONENT_REPOSITORY_NAME
  return downloadFrameworkBranchTo(properties)
    .then(function removeTemporaryDownload (properties) {
      fs.rm(properties.tmp, { recursive: true })
      return properties
    })
    .then(renameFiles)
    .then(renameVariables)
}

function renameFiles (properties) {
  const files = [
    { match: 'js/adapt-contrib-componentName.js', replace: /contrib-componentName/ },
    { match: 'less/componentName.less', replace: /componentName/ },
    { match: 'templates/componentName.hbs', replace: /componentName/ }
  ]
  const renameFiles = files.map(function (file) {
    return {
      from: properties.relative(file.match),
      to: properties.relative(file.match.replace(file.replace, properties.component.name))
    }
  })
  renameFiles.forEach(function (file) {
    fs.renameSync(file.from, file.to)
    properties.component.files.push(file.to)
  })
  return properties
}

function renameVariables (properties) {
  const renameFileContentPromises = properties.component.files.map(function (file) {
    return replaceTextContent(file, (/((contrib-)?componentName)/g), properties.component.name)
  })
  return Promise.all(renameFileContentPromises)
}

async function replaceTextContent (path, match, replacement) {
  const content = (await fs.readFile(path)).toString()
  const modifiedContent = content.replace(match, replacement)
  return await fs.writeFile(path, modifiedContent)
}
