var AdaptConsoleApplication = function (commands, renderer) {
    this.renderer = renderer || require('./ConsoleRenderer');
    this.commands = commands;
};

AdaptConsoleApplication.prototype.do = function (command, done) {
    done =  done || function () {};
    var commandArguments = [this.renderer].concat(command.parameters).concat([done]);
    this.commands[command.name].apply(this.commands, commandArguments);
};

module.exports = AdaptConsoleApplication;