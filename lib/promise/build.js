import chalk from 'chalk'
import grunt from 'grunt'

export default function build (properties) {
  const cwd = process.cwd()

  properties.renderer.log(chalk.cyan('running build'))

  grunt.loadTasks(properties.localDir)

  process.chdir(properties.localDir)
  grunt.task.run(['build'])
  process.chdir(cwd)

  return properties
}
