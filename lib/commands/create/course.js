import chalk from 'chalk'
import inquirer from 'inquirer'
import Q from 'q'
import fs from 'q-io/fs.js'
import path from 'path'
import install from '../install.js'
import getRepository from '../../promise/getRepository.js'
import removeTemporaryDownload from '../../promise/removeTemporaryDownload.js'
import { throttle } from 'lodash-es'
import { spawn } from 'child_process'
import Cwd from '../../Cwd.js'

export default function (properties) {
  const progress = throttle(function () {
    properties.renderer.write(chalk.grey('.'))
  }, 300)

  return deleteExistingCourse(properties)
    .then(function (properties) {
      properties.renderer.write(chalk.cyan('downloading framework to', properties.localDir, '\t'))
      return properties
    })
    .then(getRepository)
    .progress(function (data) {
      progress()
      return data
    })
    .then(function (properties) {
      properties.renderer.log(' ', 'done!')
      return properties
    })
    .then(removeTemporaryDownload)
    .then(function installNodeDependencies (properties /* { renderer, localDir } */) {
      return new Promise((resolve, reject) => {
        properties.renderer.log(chalk.cyan('installing node dependencies'))
        const npm = spawn((process.platform === 'win32' ? 'npm.cmd' : 'npm'), ['--unsafe-perm', 'install'], {
          stdio: 'inherit',
          cwd: properties.localDir
        })
        npm.on('close', code => {
          if (code) {
            return reject(new Error('npm install failed'))
          }
          resolve(properties)
        })
      })
    })
    .then(async function installAdaptDependencies (properties /* { renderer, localDir } */) {
      const cwd = process.cwd()
      properties.renderer.log(chalk.cyan('installing adapt dependencies'))
      if (path.relative(cwd, properties.localDir)) {
        process.chdir(properties.localDir)
        Cwd(process.cwd())
        console.log(cwd, 'change to', process.cwd())
      }
      await install(properties.renderer)
      process.chdir(cwd)
      Cwd(process.cwd())
      return properties
    })
    .then(function (properties) {
      properties.renderer.log('\n' + chalk.green(properties.localDir), 'has been created.\n')

      properties.renderer.log(chalk.grey('To build the course, run:') +
                '\n\tcd ' + properties.localDir +
                '\n\tgrunt build\n')

      properties.renderer.log(chalk.grey('Then to view the course, run:') +
                '\n\tgrunt server\n')
    })
}

function deleteExistingCourse (properties) {
  return fs.exists(properties.localDir)
    .then(function (exists) {
      if (exists) {
        const deferred = Q.defer()

        inquirer.prompt([
          {
            name: 'overwrite existing course?',
            type: 'confirm',
            default: false
          }
        ]).then(results => {
          if (results['overwrite existing course?']) {
            fs.removeTree(properties.localDir)
              .then(function () {
                deferred.resolve(properties)
              })
              .fail(function (err) {
                deferred.reject(err)
              })
          } else {
            deferred.reject(new Error('Course already exists and cannot overwrite.'))
          }
        }).catch(err => deferred.reject(err))

        return deferred.promise
      }
    })
    .then(function () {
      return properties
    })
}
