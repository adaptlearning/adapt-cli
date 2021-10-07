// import {
//   BOWER_REGISTRY_URL
// } from '../integration/PackageManagement.js'
import bower from 'bower'
import chalk from 'chalk'
import Plugin from '../integration/Plugin.js'

export default function search (logger) {
  const searchTerm = arguments.length >= 3 ? arguments[1] : ''
  const done = arguments[arguments.length - 1] || function () {}

  const plugin = new Plugin({ name: searchTerm })

  bower.commands.search(searchTerm, {
    registry: BOWER_REGISTRY_URL
  })
    .on('end', function (results) {
      if (!results.length) {
        logger?.log(chalk.yellow('no plugins found', plugin.toString()))
      }
      results.forEach(function (result) {
        logger?.log(chalk.cyan(result.name) + ' ' + result.url)
      })
      done()
    })
    .on('error', function (err) {
      logger?.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err)
      done(err)
    })
}
