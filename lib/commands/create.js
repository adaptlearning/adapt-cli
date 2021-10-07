import chalk from 'chalk'
import inquirer from 'inquirer'
import component from './create/component.js'
import course from './create/course.js'
import { checkLatestAdaptRepoVersion } from '../integration/AdaptFramework.js'

const subTasks = {
  component,
  course
}

/**
 * TODO: Change component to camel case
 */
export const DEFAULT_TYPE_NAME = {
  course: 'my-adapt-course',
  component: 'my-adapt-component'
}

export default async function create (logger, type = 'course', localDir, branch) {
  const tag = await checkLatestAdaptRepoVersion()
  const options = await confirmOptions({
    type,
    localDir,
    branch: branch || tag,
    logger
  })
  const action = subTasks[options.type]
  if (!action) throw new Error('' + options.type + ' is not a supported type')
  try {
    await action({
      localDir: options.localDir,
      branch: options.branch,
      logger
    })
  } catch (err) {
    logger?.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err.message)
    throw err
  }
}

async function confirmOptions ({ logger, type, localDir, branch }) {
  const typeSchema = [
    {
      name: 'type',
      choices: ['course', 'component'],
      type: 'list',
      default: type
    }
  ]
  const typeSchemaResults = await inquirer.prompt(typeSchema)
  const propertySchema = [
    {
      name: 'localDir',
      message: 'name',
      type: 'input',
      default: localDir || DEFAULT_TYPE_NAME[typeSchemaResults.type]
    },
    {
      name: 'branch',
      message: 'branch/tag',
      type: 'input',
      default: branch || 'not specified'
    },
    {
      name: 'ready',
      message: 'create now?',
      type: 'confirm',
      default: true
    }
  ]
  const propertySchemaResults = await inquirer.prompt(propertySchema)
  if (!propertySchemaResults.ready) throw new Error('Aborted. Nothing has been created.')
  const finalProperties = {
    ...typeSchemaResults,
    ...propertySchemaResults
  }
  return finalProperties
}
