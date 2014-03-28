var mockery = require('mockery'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    CommandTranslator = require('../../lib/CommandTranslator');

describe('Given I a list of parameters', function () {
    describe('when I translate them', function () {
        it('should translate -v to version', function () {
            var parameters = [ '-v' ];
            expect(CommandTranslator(parameters)[0]).to.be('version');
        });
    });
});