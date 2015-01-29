var mockery = require('mockery'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Q = require('q'),
    Constants = require('../../lib/Constants'),
    Project = require('../../lib/Project'),
    Plugin = require('../../lib/Plugin'),
    rimraf = require('rimraf');


describe.only('Given I have an create command', function () {
    describe('when I create a course', function () {
        it('should download the framework', function (done) {
            var command = require('../../lib/commands/create');
            command.create(console, 'course', './downloaded-files', 'develop', function () {
                expect(false).to.be(true);
                done();
            });
        });
    });
});