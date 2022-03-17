import chalk from 'chalk'
import inquirer from 'inquirer'
import request from 'request'
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
  return new Promise((resolve, reject) => {
    request({
      uri: `${BOWER_REGISTRY_CONFIG.register}authenticate/${username}/${pluginName}?access_token=${token}`,
      method: 'GET',
      headers: { 'User-Agent': 'adapt-cli' },
      followRedirect: false
    }, (err, res, body) => {
      if (err) return reject(err)
      if (res.statusCode !== 200) reject(new Error(`The server responded with ${res.statusCode}`))
      try {
        const bodyJSON = JSON.parse(body)
        resolve({ username, token, pluginName, ...bodyJSON })
      } catch (err) {
        reject(err)
      }
    })
  })
}
