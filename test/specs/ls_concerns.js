var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have an application', function () {
    var AdaptConsoleApplication  = require('../../lib/AdaptConsoleApplication'),
        CommandParser  = require('../../lib/CommandParser'),
        commands = {
            ls: sinon.stub().yields()
        },
        outputDevice = {
            log: sinon.stub()
        },
        argsv = function () {
            return ['node', 'search-concerns.js'].concat(Array.prototype.slice.call(arguments));
        },
        app =  new AdaptConsoleApplication(commands, outputDevice);
            
    describe('when I execute an ls command for an existing package', function () {
        it('should list the package', function (done) {
            var ls_command = new CommandParser(argsv('ls'));
            app.do(ls_command, function (err, results) {
                expect(commands.ls.calledWith(outputDevice)).to.be(true);
                done();
            });
        });
    });
    
});