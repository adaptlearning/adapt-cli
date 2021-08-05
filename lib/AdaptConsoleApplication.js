import ConsoleRenderer from './ConsoleRenderer.js'

const AdaptConsoleApplication = function (commands, renderer) {
  this.renderer = renderer || ConsoleRenderer
  this.commands = commands
}

AdaptConsoleApplication.prototype.do = function (command, done) {
  done = done || function () {}

  if (!Object.prototype.hasOwnProperty.call(this.commands, command.name)) {
    const e = new Error('Unknown command "' + command.name + '", please check the documentation.')
    this.renderer.log(e.message)
    done(e)
  }

  const commandArguments = [this.renderer].concat(command.parameters).concat([done])
  this.commands[command.name].apply(this.commands, commandArguments)
}

export default AdaptConsoleApplication
