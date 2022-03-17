import readline from 'readline'
import chalk from 'chalk'

export default {
  isLoggingProgress: false,
  logProgress (...args) {
    this.isLoggingProgress = true
    readline.cursorTo(process.stdout, 0)
    this.write(args.join(' '))
  },
  warn (...args) {
    chalk.yellow(...args)
  },
  error (...args) {
    chalk.red(...args)
  },
  log (...args) {
    if (this.isLoggingProgress) {
      this.isLoggingProgress = false
      readline.cursorTo(process.stdout, 0)
      this.write(args.join(' '))
      this.write('\n')
      return
    }
    console.log.apply(console, args)
  },
  write: process.stdout.write.bind(process.stdout)
}
