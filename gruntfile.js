module.exports = function(grunt) {
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		mochaTest: {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/specs/**/*.js']
            }
        }
	});
	
    grunt.registerTask('default', ['mochaTest']);
    grunt.registerTask('test', ['mochaTest']);
};