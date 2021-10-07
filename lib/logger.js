import readline from 'readline'

export default {
  isLoggingProgress: false,
  lastProgressStr: '',
  logProgress (str) {
    this.lastProgressStr = str
    this.isLoggingProgress = true
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(str)
  },
  logProgressConclusion (str) {
    this.lastProgressStr = str
    this.isLoggingProgress = false
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(str)
    process.stdout.write('\n')
  },
  log (...args) {
    if (this.isLoggingProgress) {
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
      console.log.apply(console, args)
      this.logProgress(this.lastProgressStr)
      return
    }
    console.log.apply(console, args)
  },
  write: process.stdout.write.bind(process.stdout)
}
