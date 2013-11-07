var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have an application', function () {
    var AdaptConsoleApplication  = require('../../lib/AdaptConsoleApplication'),
        CommandParser  = require('../../lib/CommandParser'),
        installResult = {
            success: true
        },
        commands = {
            install: sinon.stub().yields(null, installResult)
        },
        outputDevice = {
            log: sinon.stub()
        },
        argsv = function () {
            return ['node', 'search-concerns.js'].concat(Array.prototype.slice.call(arguments));
        },
        app =  new AdaptConsoleApplication(commands, outputDevice);
            
    describe('when I execute an install command for an existing package', function () {
        it('should install the package', function (done) {
            var install_command = new CommandParser(argsv('install', 'package-name'));
            app.do(install_command, function (err, results) {
                expect(commands.install.calledWith(outputDevice, 'package-name')).to.be(true);
                done();
            });
        });
    });
    
});