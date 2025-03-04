import inquirer from 'inquirer'
import component from './create/component.js'
import question from './create/question.js'
import extension from './create/extension.js'
import course from './create/course.js'
import { ADAPT_FRAMEWORK } from '../util/constants.js'
import { getLatestVersion as getAdaptLatestVersion } from '../integration/AdaptFramework.js'

const subTasks = {
  component,
  question,
  extension,
  course
}

/**
 * TODO: Change component name to camel case
 */
export const DEFAULT_TYPE_NAME = {
  course: 'my-adapt-course',
  component: 'myAdaptComponent',
  question: 'myAdaptQuestion',
  extension: 'myAdaptExtension'
}

export default async function create (logger, type = 'course', name, branch, bypassPrompts) {
  let options = {
    type,
    name,
    branch
  }

  if (!bypassPrompts) {
    options = await confirmOptions({
      type,
      name,
      branch,
      logger
    })
  }

  const action = subTasks[options.type]
  if (!action) throw new Error('' + options.type + ' is not a supported type')
  try {
    await action({
      name: options.name,
      branch: options.branch,
      cwd: process.cwd(),
      logger
    })
  } catch (err) {
    logger?.error("Oh dear, something went wrong. I'm terribly sorry.", err.message)
    throw err
  }
}

async function confirmOptions ({ logger, type, name, branch }) {
  const typeSchema = [
    {
      name: 'type',
      choices: ['course', 'component', 'question', 'extension'],
      type: 'list',
      default: type
    }
  ]
  const typeSchemaResults = await inquirer.prompt(typeSchema)
  branch = branch || (typeSchemaResults.type === 'course')
    ? await getAdaptLatestVersion({ repository: ADAPT_FRAMEWORK })
    : 'master'
  const propertySchema = [
    {
      name: 'branch',
      message: 'branch/tag',
      type: 'input',
      default: branch || 'not specified'
    },
    {
      name: 'name',
      message: 'name',
      type: 'input',
      default: name || DEFAULT_TYPE_NAME[typeSchemaResults.type]
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
