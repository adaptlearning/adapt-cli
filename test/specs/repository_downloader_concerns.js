var mockery = require('mockery'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Q = require('q'),
    Constants = require('../../lib/Constants'),
    Project = require('../../lib/Project'),
    Plugin = require('../../lib/Plugin'),
    rimraf = require('rimraf');

describe('Given I have a repository downloader', function () {
    describe('when fetch the repo', function () {
        var location = './test/fixtures/downloaded-repo',
            renderer =  {
                log: sinon.stub()
            },
            eventEmitter = {
                on: function (event, handler) {
                    if(event === 'close') {
                        setTimeout(handler, 100);
                    }
                    return eventEmitter;
                },
                then: function(handler) {
                    setTimeout(handler, 100);
                    return this;
                }
            },
            download = sinon.stub().returns(eventEmitter);

        before(function () {
            mockery.registerMock('download', download);
        });

        it('should download the repo to the target directory', function (done) {
            mockery.enable({ warnOnUnregistered:false });
            var RepositoryDownloader = require('../../lib/RepositoryDownloader'),
                downloader = new RepositoryDownloader({
                    repository : 'https://github.com/adaptlearning/adapt-cli/',
                    branch : 'master' 
                });

            downloader.fetch(location)
            .then(function () {
                expect(download.called).to.be(true);
                done();
            });
        });

        after(function () {
            mockery.deregisterAll();
            mockery.disable();
        });
    });
    
});