var path = require('path'),
    _ = require('lodash'),
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

    var commands = require('./commands'),
        app = new AdaptConsoleApplication(commands, console);

    app.do(this.command, process.exit);
}

module.exports = {
    command: null,

    withOptions: withOptions,
    withPackage: withPackage,
    execute: execute
};