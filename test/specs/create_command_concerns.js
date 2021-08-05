var mockery = require('mockery'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Q = require('q'),
    CONSTANTS = require('../../lib/CONSTANTS'),
    Project = require('../../lib/Project'),
    Plugin = require('../../lib/Plugin'),
    rimraf = require('rimraf');

/* mockery is just too slow to run as a unit test
describe('Given I have an create command', function () {
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
*/
