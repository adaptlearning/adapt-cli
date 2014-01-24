var Q = require('q'),
    chalk = require('chalk'),
    grunt = require('grunt');

module.exports = function build(properties) {
    var deferred = Q.defer(),
        cwd = process.cwd();

    

    properties.renderer.log(chalk.cyan('running build'));

    grunt.loadTasks(properties.localDir);
    
    process.chdir(properties.localDir);
    grunt.task.run(['build']);
    process.chdir(cwd);

    return properties;
};