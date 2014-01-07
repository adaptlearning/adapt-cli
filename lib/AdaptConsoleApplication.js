var AdaptConsoleApplication = function (commands, renderer) {
    this.renderer = renderer || require('./ConsoleRenderer');
    this.commands = commands;
};

AdaptConsoleApplication.prototype.do = function (command, done) {
    done =  done || function () {};
    if(!this.commands.hasOwnProperty(command.name)) {
        var e = new Error('Unknown command "' + command.name + '", please check the documentation.');
        this.renderer.log(e.message);
        done(e);
    }
    this.commands[command.name](this.renderer, command.param(0), done);
};

module.exports = AdaptConsoleApplication;