var sinon = require('sinon'),
    expect = require('expect.js'),
    Project = require('../../lib/Project'),
    RendererHelpers = require('../../lib/RendererHelpers'),
    Q = require('q');

describe('Given that I have Adapt Framework version 2', function () {
    describe('When I install a plugin that is tagged as compatible with Adapt V2 framework version', function () {
        it('should install it', function (done) {

            var context = createContext({
                pluginCompatibility: '~2.0.0',
                frameworkVersion: '2.0.0'
            });

            var installCommand = require('../../lib/commands/install')(context);

            installCommand.install(context.renderer, 'plugin', function () {
                expect(context.install.called).to.be(true);
                done();
            });
        });

        after(function() {
            Project.prototype.getFrameworkVersion.restore();
            RendererHelpers.reportCompatibilityWarning.restore();
        });
    });
});

describe('Given that I have Adapt Framework version 1.1.1 or earlier', function () {
    describe('When I install a plugin that is tagged as compatible with Adapt V1.1 framework version', function () {
        it('should install it', function (done) {

            var context = createContext({
                pluginCompatibility: '1.1.1',
                frameworkVersion: '1.1.1'
            });

            var installCommand = require('../../lib/commands/install')(context);

            installCommand.install(context.renderer, 'plugin', function (err) {
                expect(context.install.called).to.be(true);
                done();
            });
        });

        after(function() {
            Project.prototype.getFrameworkVersion.restore();
            RendererHelpers.reportCompatibilityWarning.restore();
        });
    });
});

describe('Given that I have Adapt Framework version 1.1.1 or earlier', function () {
    describe('When I install a plugin that is NOT tagged', function () {
        it('should install it', function (done) {

            var context = createContext({
                pluginCompatibility: '*',
                frameworkVersion: '1.1.1'
            });

            var installCommand = require('../../lib/commands/install')(context);

            installCommand.install(context.renderer, 'plugin', function () {
                expect(context.install.called).to.be(true);
                done();
            });
        });

        after(function() {
            Project.prototype.getFrameworkVersion.restore();
            RendererHelpers.reportCompatibilityWarning.restore();
        });
    });
});

function createContext(values) {
    var getKeywordsSuccessfully = Q.defer(),
        getFrameworkCompatibilitySuccessfully  = Q.defer(),
        installSuccessfully = Q.defer();

    getKeywordsSuccessfully.resolve('adapt-extension');
    getFrameworkCompatibilitySuccessfully.resolve(values.pluginCompatibility);
    installSuccessfully.resolve(true);

    var warning = sinon.stub().yields();

    var stubs = {
        bower: {
            commands: {
                install: sinon.stub()
            }
        },
        renderer: values.renderer || { log: sinon.stub() },
        RendererHelpers: RendererHelpers,
        Project: Project,
        PackageMeta: {
            getKeywords: sinon.stub().returns(getKeywordsSuccessfully.promise),
            getFrameworkCompatibility: sinon.stub().returns(getFrameworkCompatibilitySuccessfully.promise)
        },
        install: sinon.stub().returns(installSuccessfully.promise),
        warning: warning
    };

    sinon.stub(stubs.RendererHelpers, 'reportCompatibilityWarning').returns(warning);
    sinon.stub(stubs.Project.prototype, 'getFrameworkVersion').returns(values.frameworkVersion);
    return stubs;
}