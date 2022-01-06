import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'

export default async function authenticate ({
  username = null,
  password = null,
  repository
}) {
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
  username = confirmation.username
  password = confirmation.password
  return new Promise((resolve, reject) => {
    bower.commands.login(repository, { interactive: true })
      .on('prompt', function (prompts, callback) {
        // eslint-disable-next-line node/no-callback-literal
        callback({
          username,
          password
        })
      })
      .on('end', function (result) {
        if (!result || !result.token) return reject(new Error('Login failed'))
        resolve({
          username,
          password,
          token: result.token
        })
      })
      .on('error', reject)
  })
}
