// import {
//   BOWER_REGISTRY_URL
// } from '../integration/PackageManagement.js'
import bower from 'bower'
import chalk from 'chalk'
import Plugin from '../integration/Plugin.js'

export default function search (renderer) {
  const searchTerm = arguments.length >= 3 ? arguments[1] : ''
  const done = arguments[arguments.length - 1] || function () {}

  const plugin = new Plugin(searchTerm)

  bower.commands.search(searchTerm, {
    registry: BOWER_REGISTRY_URL
  })
    .on('end', function (results) {
      if (!results.length) {
        renderer.log(chalk.yellow('no plugins found', plugin.toString()))
      }
      results.forEach(function (result) {
        renderer.log(chalk.cyan(result.name) + ' ' + result.url)
      })
      done()
    })
    .on('error', function (err) {
      renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err)
      done(err)
    })
}
