import build from './commands/build.js'
import create from './commands/create.js'
import devinstall from './commands/devinstall.js'
import help from './commands/help.js'
import install from './commands/install.js'
import ls from './commands/ls.js'
import register from './commands/register.js'
import rename from './commands/rename.js'
import search from './commands/search.js'
import uninstall from './commands/uninstall.js'
import unregister from './commands/unregister.js'
import update from './commands/update.js'
import version from './commands/version.js'
import logger from './logger.js'

const commands = {
  build,
  create,
  devinstall,
  help,
  install,
  ls,
  register,
  rename,
  search,
  uninstall,
  unregister,
  update,
  version
}

const translationTable = [
  { pattern: /^-v$|^--version$/i, replacement: 'version' },
  { pattern: /^upgrade$/i, replacement: 'update' }
]

class CLI {
  withOptions (argv = process.argv || ['node', 'path']) {
    const parameters = argv.slice(2).map(param => {
      const translation = translationTable.find(item => item.pattern.test(param))
      return translation ? translation.replacement : param
    })
    const name = parameters.length
      ? String.prototype.toLowerCase.call(parameters.shift())
      : ''
    this.command = {
      name,
      parameters
    }
    return this
  }

  async execute () {
    try {
      if (!commands[this.command.name]) {
        const e = new Error(`Unknown command "${this.command.name}", please check the documentation.`)
        logger?.log(e.message)
        throw e
      }
      const commandArguments = [logger].concat(this.command.parameters)
      await commands[this.command.name](...commandArguments)
    } catch (err) {
      console.error(err)
      process.exit(err ? 1 : 0)
    }
  }
}

export default new CLI()
