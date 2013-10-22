var path = require('path'),
	CommandParser  =require('./CommandParser'),
	AdaptConsoleApplication = require('./AdaptConsoleApplication');

function withPackage(pack) {
	this.pkg = pack || require(path.join(__dirname, '..', 'package.json'));
	return this;
}

function withOptions(argv) {
    argv = argv || process.argv;
    this.command = new CommandParser(argv);
    return this;
}

function execute() {
    var app = new AdaptConsoleApplication(require('./commands/BowerSearch'));
    app.do(this.command, process.exit);
}

module.exports = {
    command: null,

    withOptions: withOptions,
    withPackage: withPackage,
    execute: execute
};