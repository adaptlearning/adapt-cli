var AdaptConsoleApplication = function (commands, renderer) {
    this.renderer = renderer || require('./ConsoleRenderer');
    this.commands = commands;
};

AdaptConsoleApplication.prototype.do = function (command, done) {
    done =  done || function () {};
    this.commands[command.name](this.renderer, command.param(0), done);
};

module.exports = AdaptConsoleApplication;