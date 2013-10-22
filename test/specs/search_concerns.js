var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have an application', function () {
    var AdaptConsoleApplication  = require('../../lib/AdaptConsoleApplication'),
        CommandParser  = require('../../lib/CommandParser'),
        searchResults = [
            "blah"
        ],
        commands = {
            search: sinon.stub().yields(null, searchResults)
        },
        outputDevice = {
            log: sinon.stub()
        },
        argsv = function () {
            return ['node', 'search-concerns.js'].concat(Array.prototype.slice.call(arguments));
        },
        app =  new AdaptConsoleApplication(commands, outputDevice);
            
    describe('when I execute a search command for a term', function () {
        it('should perform a search for the term', function (done) {
            var search_command = new CommandParser(argsv('search', 'term'));
            app.do(search_command, function (err, results) {
                expect(commands.search.calledWith(outputDevice, 'term')).to.be(true);
                done();
            });
        });
    });
});