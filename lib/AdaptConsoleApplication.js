var AdaptConsoleApplication = function (commands, renderer) {
    this.renderer = renderer || require('./ConsoleRenderer');
    this.commands = commands;
};

function renderAndContinue(done, context) {
    return function log(err, result) {
        if(err) return done(err);
        this.renderer.log(result);
        done();
    }.bind(context || this);
}

AdaptConsoleApplication.prototype.do = function (command, done) {
    done =  done || function () {};
    if(command.name === 'search') {
        this.renderer.log('Searching for', command.param(0));
        this.commands.search(this.renderer, command.param(0), renderAndContinue(done, this));
    }
};

module.exports = AdaptConsoleApplication;