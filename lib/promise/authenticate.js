import bower from 'bower'
import chalk from 'chalk'
import inquirer from 'inquirer'
import Q from 'q'

export default function (properties) {
  return Q.fcall(ask, properties).then(login)
}

function ask (properties) {
  const deferred = Q.defer()
  const schema = [
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
  ]
  inquirer.prompt(schema).then(confirmation => {
    properties.username = confirmation.username
    properties.password = confirmation.password
    deferred.resolve(properties)
  }).catch(err => deferred.reject(err))
  return deferred.promise
}

function login (properties) {
  const deferred = Q.defer()

  bower.commands.login(properties.repository, { interactive: true })
    .on('prompt', function (prompts, callback) {
      // eslint-disable-next-line node/no-callback-literal
      callback({
        username: properties.username,
        password: properties.password
      })
    })
    .on('end', function (result) {
      if (!result || !result.token) {
        deferred.reject()
      } else {
        // log('end', result);
        // log('token ',result.token);
        properties.token = result.token
        deferred.resolve(properties)
      }
    })
    .on('error', function (err) {
      // log('login:error', err);
      deferred.reject(err)
    })
  return deferred.promise
}
