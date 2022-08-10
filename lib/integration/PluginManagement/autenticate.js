import chalk from 'chalk'
import inquirer from 'inquirer'
import fetch from 'node-fetch'
import getBowerRegistryConfig from '../getBowerRegistryConfig.js'
import path from 'path'

export default async function authenticate ({
  pluginName,
  cwd = process.cwd()
} = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const BOWER_REGISTRY_CONFIG = getBowerRegistryConfig({ cwd })
  // check if github, do github device oauth workflow
  // if not github, send request to repo anyway
  const questions = [
    {
      name: 'username',
      message: chalk.cyan('GitHub username')
    },
    {
      name: 'token',
      message: chalk.cyan('GitHub personal access token (with public_repo access)'),
      type: 'password',
      mask: '*'
    }
  ]
  if (!pluginName) {
    questions.unshift({
      name: 'pluginName',
      message: chalk.cyan('Plugin name'),
      default: pluginName
    })
  }
  const confirmation = await inquirer.prompt(questions)
  if (!pluginName) {
    ({ pluginName } = confirmation)
  }
  const { username, token } = confirmation
  const response = await fetch(`${BOWER_REGISTRY_CONFIG.register}authenticate/${username}/${pluginName}?access_token=${token}`, {
    headers: { 'User-Agent': 'adapt-cli' },
    followRedirect: false,
    method: 'GET'
  })
  if (response.status !== 200) throw new Error(`The server responded with ${response.status}`)
  const body = await response.json()
  return { username, token, pluginName, ...body }
}
