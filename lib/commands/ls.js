import chalk from 'chalk'
import _ from 'lodash'
import Project from '../integration/Project.js'
import { eachOfLimitProgress } from '../util/promises.js'

export default async function ls (logger) {
  const project = new Project({ logger })
  const frameworkVersion = project.version
  project.tryThrowInvalidPath()
  const installTargets = (await project.getInstallTargets())
  const installTargetsIndex = installTargets.reduce((hash, p) => {
    const name = (p.name || p.sourcePath)
    hash[name] = p
    return hash
  }, {})
  const installedPlugins = await project.getInstalledPlugins();
  const notInstalled = _.difference(installTargets.map(p => (p.name || p.sourcePath)), installedPlugins.map(p => (p.name || p.sourcePath)))
  const plugins = installedPlugins.concat(notInstalled.map(name => installTargetsIndex[name]))
  await eachOfLimitProgress(
    plugins,
    async (target) => {
      await target.fetchProjectInfo()
      await target.fetchSourceInfo()
      await target.findCompatibleVersion(frameworkVersion)
    },
    percentage => logger?.logProgress?.(`${chalk.bold.cyan('<info>')} Getting plugin info ${percentage}% complete`)
  )
  logger?.log(`${chalk.bold.cyan('<info>')} Getting plugin info 100% complete`)
  plugins
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach(p => {
      const name = (p.name || p.sourcePath)
      logger?.log(`${chalk.cyan(p.name || p.sourcePath)} ${chalk.green('adapt.json')}: ${installTargetsIndex[name]?.requestedVersion || 'n/a'} ${chalk.green('installed')}: ${p.sourcePath || p.projectVersion || 'n/a'} ${chalk.green('latest')}: ${p.sourcePath || p.latestCompatibleSourceVersion || 'n/a'}`)
    })
}
