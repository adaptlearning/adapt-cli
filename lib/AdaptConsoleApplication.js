var AdaptConsoleApplication = function (commands, renderer) {
    this.renderer = renderer || require('./ConsoleRenderer');
    this.commands = commands;
};

AdaptConsoleApplication.prototype.do = function (command, done) {
    done =  done || function () {};
    if(command.name === 'search') {
        this.commands.search(this.renderer, command.param(0));
    }
};

module.exports = AdaptConsoleApplication;