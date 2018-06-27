var readline = require('readline');

var isLoggingProgress = false;
var lastProgressStr = '';

module.exports = {
	logProgress:function(str) {
		lastProgressStr = str;
		isLoggingProgress = true;
		readline.cursorTo(process.stdout, 0);
        process.stdout.write(str);
	},

	logProgressConclusion(str) {
		lastProgressStr = str;
		isLoggingProgress = false;
		readline.cursorTo(process.stdout, 0);
        process.stdout.write(str);
        process.stdout.write('\n');
	},

	log:function() {
		if (isLoggingProgress) {
			readline.clearLine(process.stdout, 0);
			readline.cursorTo(process.stdout, 0);
			console.log.apply(console, arguments);
			this.logProgress(lastProgressStr);
		} else {
			console.log.apply(console, arguments);
		}
	}
}