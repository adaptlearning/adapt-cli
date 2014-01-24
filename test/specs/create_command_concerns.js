var mockery = require('mockery'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Q = require('q'),
    Constants = require('../../lib/Constants'),
    Project = require('../../lib/Project'),
    Plugin = require('../../lib/Plugin'),
    rimraf = require('rimraf');

/* this test runs too slow
describe('Given I have an create command', function () {
    describe('when I create a course', function () {
        var renderer =  {
                log: sinon.stub()
            },
            eventEmitter = {
                on: function (event, handler) {
                    if(event === 'close') {
                        setTimeout(handler, 100);
                    }
                    return eventEmitter;
                }
            },
            download = sinon.stub().returns(eventEmitter);

        before(function () {
            mockery.registerMock('download', download);
        });

        it('should download the framework', function (done) {
            mockery.enable({ warnOnUnregistered:false });

            var command = require('../../lib/commands/create');
            command.create(renderer, 'course', './downloaded-files', 'develop', function () {
                expect(download.called).to.be(true);
                done();
            });
        });

        after(function () {
            mockery.deregisterAll();
            mockery.disable();
        });
    });
    
}); */