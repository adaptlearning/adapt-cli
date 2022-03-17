import inquirer from 'inquirer'

export async function createPromptTask (question) {
  question = Object.assign({}, { name: 'question' }, question)
  const confirmation = await inquirer.prompt([question])
  return confirmation.question
}
