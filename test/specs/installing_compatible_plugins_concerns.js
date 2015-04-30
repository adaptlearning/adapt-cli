var sinon = require('sinon'),
    expect = require('expect.js'),
    Project = require('../../lib/Project'),
    Q = require('q');

describe('Given that I have Adapt Framework version 2', function () {
    describe('When I install a plugin that is tagged as compatible with Adapt V2 framework version', function () {
        it('should install it', function (done) {

            var getKeywordsSuccessfully = Q.defer(),
                installSuccessfully = Q.defer();

            getKeywordsSuccessfully.resolve('adapt-extension');
            installSuccessfully.resolve(true);

            var stubs = {
                    bower: {
                        commands: {
                            install: sinon.stub()
                        }
                    },
                    renderer: { log: sinon.stub() },
                    Project: Project,
                    PackageMeta: {
                        getKeywords: sinon.stub().returns(getKeywordsSuccessfully.promise)
                    },
                    install: sinon.stub().returns(installSuccessfully.promise),
                };

            sinon.stub(stubs.Project.prototype, 'getFrameworkVersion').returns('2.0.0');

            var installCommand = require('../../lib/commands/install')(stubs);

            installCommand.install(stubs.renderer, 'plugin', function (err) {
                expect(stubs.install.called).to.be(true);
                done();
            });
        });

        after(function() {
            Project.prototype.getFrameworkVersion.restore();
        });
    });
});


describe('Given that I have Adapt Framework version 1.1.1 or earlier', function () {
    describe('When I install a plugin that is NOT tagged', function () {
        it('should install it', function (done) {

            var getKeywordsSuccessfully = Q.defer(),
                installSuccessfully = Q.defer();

            getKeywordsSuccessfully.resolve('adapt-extension');
            installSuccessfully.resolve(true);

            var stubs = {
                    bower: {
                        commands: {
                            install: sinon.stub()
                        }
                    },
                    renderer: { log: sinon.stub() },
                    Project: Project,
                    PackageMeta: {
                        getKeywords: sinon.stub().returns(getKeywordsSuccessfully.promise)
                    },
                    install: sinon.stub().returns(installSuccessfully.promise),
                };

            sinon.stub(stubs.Project.prototype, 'getFrameworkVersion').returns('1.1.1');

            var installCommand = require('../../lib/commands/install')(stubs);

            installCommand.install(stubs.renderer, 'plugin', function (err) {
                expect(stubs.install.called).to.be(true);
                done();
            });
        });

        after(function() {
            Project.prototype.getFrameworkVersion.restore();
        });
    });
});