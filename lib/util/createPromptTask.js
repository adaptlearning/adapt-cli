import inquirer from 'inquirer'

export async function createPromptTask (params) {
  const defaultConfig = {
    name: 'question',
    onlyRejectOnError: false
  }
  const config = Object.assign({}, defaultConfig, params)
  const schema = [config]
  return inquirer.prompt(schema).then(confirmation => {
    if (!config.onlyRejectOnError && !confirmation.question) throw new Error('Aborted. Nothing has been updated.')
    return confirmation.question
  })
}
