var path = require('path'),
    _ = require('lodash'),
    CommandParser = require('./CommandParser'),
    AdaptConsoleApplication = require('./AdaptConsoleApplication'),
    stdoutRenderer = {
        log: _.bind(console.log, console),
        write: _.bind(process.stdout.write, process.stdout)
    };

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
        app = new AdaptConsoleApplication(commands, stdoutRenderer);

    app.do(this.command, function (err) {
        process.exit(err ? 1: 0);
    });
}

module.exports = {
    command: null,
    withOptions: withOptions,
    withPackage: withPackage,
    execute: execute
};