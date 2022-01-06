import { getBowerRegistry } from '../integration/PluginManagement.js'
import Project from '../integration/Project.js'
import bower from 'bower'
import chalk from 'chalk'
import Plugin from '../integration/Plugin.js'

export default async function search ({
  logger,
  searchTerm
}) {
  const project = new Project({ logger })
  const BOWER_REGISTRY_URL = getBowerRegistry(project)
  const plugin = new Plugin({ name: searchTerm })
  return new Promise((resolve, reject) => {
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
        resolve(results)
      })
      .on('error', function (err) {
        logger?.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err)
        reject(err)
      })
  })
}
