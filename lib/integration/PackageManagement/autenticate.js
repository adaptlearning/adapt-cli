import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'

// check adapt version for switching bower and npm style package management

export default async function authenticate (properties) {
  const confirmation = await inquirer.prompt([
    {
      name: 'username',
      message: chalk.cyan('GitHub username')
    },
    {
      name: 'password',
      message: chalk.cyan('GitHub password'),
      type: 'password',
      mask: '*'
    }
  ])
  properties.username = confirmation.username
  properties.password = confirmation.password
  return new Promise((resolve, reject) => {
    bower.commands.login(properties.repository, { interactive: true })
      .on('prompt', function (prompts, callback) {
        // eslint-disable-next-line node/no-callback-literal
        callback({
          username: properties.username,
          password: properties.password
        })
      })
      .on('end', function (result) {
        if (!result || !result.token) return reject(new Error('Login failed'))
        properties.token = result.token
        resolve(properties)
      })
      .on('error', reject)
  })
}
