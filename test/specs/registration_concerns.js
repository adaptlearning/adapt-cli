var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have an application', function () {
    var AdaptConsoleApplication  = require('../../lib/AdaptConsoleApplication'),
        CommandParser  = require('../../lib/CommandParser'),
        registerResult = {
            success: true
        },
        commands = {
            register: sinon.stub().yields(null, registerResult)
        },
        outputDevice = {
            log: sinon.stub()
        },
        argsv = function () {
            return ['node', 'register-concerns.js'].concat(Array.prototype.slice.call(arguments));
        },
        app =  new AdaptConsoleApplication(commands, outputDevice);
            
    describe('when I execute a register command for a new package', function () {
        it('should register the package', function (done) {
            var register_command = new CommandParser(argsv('register', 'package-name', 'git-endpoint'));
            app.do(register_command, function (err, results) {
                expect(commands.register.calledWith(outputDevice, 'package-name', 'git-endpoint')).to.be(true);
                done();
            });
        });
    });
    
});