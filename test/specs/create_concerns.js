var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have an application', function () {
    var AdaptConsoleApplication  = require('../../lib/AdaptConsoleApplication'),
        CommandParser  = require('../../lib/CommandParser'),
        createResult = {
            success: true
        },
        commands = {
            create: sinon.stub().yields(null, createResult)
        },
        outputDevice = {
            log: sinon.stub()
        },
        argsv = function () {
            return ['node', 'create-concerns.js'].concat(Array.prototype.slice.call(arguments));
        },
        app =  new AdaptConsoleApplication(commands, outputDevice);
            
    describe('when I execute a create command', function () {
        it('should create the package', function (done) {
            var create_command = new CommandParser(argsv('create', 'package-name'));
            app.do(create_command, function (err, results) {
                expect(commands.create.calledWith(outputDevice, 'package-name')).to.be(true);
                done();
            });
        });
    });
});