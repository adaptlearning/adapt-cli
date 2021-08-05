import {
  COMPONENT_REPOSITORY,
  COMPONENT_REPOSITORY_NAME
} from '../../CONSTANTS.js'
import fs from 'fs'
import path from 'path'
import chalk from 'chalk'
import Q from 'q'
import getRepository from '../../promise/getRepository.js'
import removeTemporaryDownload from '../../promise/removeTemporaryDownload.js'
import replaceTextContent from '../../promise/replaceTextContent.js'
import slug from '../../Slug.js'

export default function (properties) {
  properties.component = {
    name: slug(properties.localDir),
    files: []
  }
  properties.relative = function (file) {
    return path.join(this.localDir, file)
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
  return getRepository(properties)
    .then(removeTemporaryDownload)
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
  return Q.all(renameFileContentPromises).then(function () {
    return properties
  })
}
