var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have an application', function () {
    var AdaptConsoleApplication  = require('../../lib/AdaptConsoleApplication'),
        CommandParser  = require('../../lib/CommandParser'),
        uninstallResult = {
            success: true
        },
        commands = {
            uninstall: sinon.stub().yields(null, uninstallResult)
        },
        outputDevice = {
            log: sinon.stub()
        },
        argsv = function () {
            return ['node', 'search-concerns.js'].concat(Array.prototype.slice.call(arguments));
        },
        app =  new AdaptConsoleApplication(commands, outputDevice);
            
    describe('when I execute an uninstall command for an existing package', function () {
        it('should uninstall the package', function (done) {
            var uninstall_command = new CommandParser(argsv('uninstall', 'package-name'));
            app.do(uninstall_command, function (err, results) {
                expect(commands.uninstall.calledWith(outputDevice, 'package-name')).to.be(true);
                done();
            });
        });
    });
    
});