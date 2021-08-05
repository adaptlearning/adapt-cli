import commands from './commands/index.js'
import fs from 'fs-extra'
import path from 'path'
import CommandParser from './CommandParser.js'
import AdaptConsoleApplication from './AdaptConsoleApplication.js'
import importMetaToDirName from './importMetaToDirName.js'
const __dirname = importMetaToDirName(import.meta)

const stdoutRenderer = {
  log: console.log.bind(console),
  write: process.stdout.write.bind(process.stdout)
}

function withPackage (pack) {
  this.pkg = pack || fs.readJSONSync(path.join(__dirname, '../package.json'))
  return this
}

function withOptions (argv) {
  argv = argv || process.argv
  this.command = new CommandParser(argv)
  return this
}

function execute () {
  const app = new AdaptConsoleApplication(commands, stdoutRenderer)

  app.do(this.command, function (err) {
    process.exit(err ? 1 : 0)
  })
}

function getApi () {
  const apiCommands = {}

  Object.entries(commands).forEach(([commandName, command]) => {
    const prefix = 'api'
    if (commandName.startsWith(prefix)) {
      apiCommands[commandName.split(prefix)[1]] = command
    }
  })

  return {
    commands: apiCommands
  }
}

export default {
  command: null,
  withOptions: withOptions,
  withPackage: withPackage,
  execute: execute,
  api: getApi()
}
