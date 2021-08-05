import {
  DEFAULT_CREATE_TYPE,
  DEFAULT_TYPE_NAME
} from '../CONSTANTS.js'
import chalk from 'chalk'
import inquirer from 'inquirer'
import component from './create/component.js'
import course from './create/course.js'
import highest from '../promise/highest.js'

const subTasks = { component, course }

export default async function create (renderer) {
  const type = arguments.length >= 3 ? arguments[1] : DEFAULT_CREATE_TYPE
  const localDir = arguments.length >= 4 ? arguments[2] : undefined
  const branch = arguments.length >= 5 ? arguments[3] : undefined
  const done = arguments[arguments.length - 1]
  const tag = await highest()
  const properties = await confirm({
    type: type,
    localDir: localDir,
    branch: branch || tag,
    renderer: renderer
  })
  const action = subTasks[properties.type]
  if (!action) throw new Error('' + properties.type + ' is not a supported type')
  try {
    await action(properties)
  } catch (err) {
    renderer.log(chalk.red("Oh dear, something went wrong. I'm terribly sorry."), err.message)
    done(err)
  }
}

async function confirm (properties) {
  const renderer = properties.renderer

  const typeSchema = [
    {
      name: 'type',
      choices: ['course', 'component'],
      type: 'list',
      default: properties.type
    }
  ]

  const typeSchemaResults = await inquirer.prompt(typeSchema)
  const propertySchema = [
    {
      name: 'localDir',
      message: 'name',
      type: 'input',
      default: properties.localDir || DEFAULT_TYPE_NAME[typeSchemaResults.type]
    },
    {
      name: 'branch',
      message: 'branch/tag',
      type: 'input',
      default: properties.branch || 'not specified'
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

  const finalProperties = Object.assign({},
    typeSchemaResults,
    propertySchemaResults,
    {
      renderer: renderer
    })
  return finalProperties
}
