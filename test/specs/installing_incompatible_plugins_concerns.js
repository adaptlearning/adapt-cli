var fs = require('fs'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Project = require('../../lib/Project'),
    RendererHelpers = require('../../lib/RendererHelpers'),
    Q = require('q');

describe('Given that I have Adapt Framework version 2', function () {
    describe('When I install a plugin that is tagged as incompatible with Adapt V2 framework version', function () {
        before(function () {
            fs.writeFileSync('./adapt.json', JSON.stringify(require('../fixtures/adapt.json')));
        });

        it('should warn that the plugin is incompatible', function (done) {

            var context = createContext({
                frameworkVersion: '2.0.0',
                pluginCompatibility: '1.1.1'
            });

            var installCommand = require('../../lib/commands/install')(context);

            installCommand.install(context.renderer, 'plugin', function (err) {
                try {
                    expect(RendererHelpers.reportCompatibilityWarning.called).to.be(true);
                    done();
                }
                catch(ex) { done(ex); }
            });
        });

        after(function() {
            fs.unlinkSync('./adapt.json');
            Project.prototype.getFrameworkVersion.restore();
            RendererHelpers.reportCompatibilityWarning.restore();
        });
    });
});

describe('Given that I have Adapt Framework version 1.1.1 or earlier', function () {
    describe('When I install a plugin that is tagged as compatible with Adapt V2 framework version', function () {
        before(function () {
            fs.writeFileSync('./adapt.json', JSON.stringify(require('../fixtures/adapt.json')));
        });

        it('should warn that the plugin is incompatible', function (done) {

            var context = createContext({
                frameworkVersion: '1.1.1',
                pluginCompatibility: '>2.0.0'
            });

            var installCommand = require('../../lib/commands/install')(context);

            installCommand.install(context.renderer, 'plugin', function (err) {
                try {
                    expect(RendererHelpers.reportCompatibilityWarning.called).to.be(true);
                    done();
                }
                catch(ex) { done(ex); }
            });
        });

        after(function() {
            fs.unlinkSync('./adapt.json');
            Project.prototype.getFrameworkVersion.restore();
            RendererHelpers.reportCompatibilityWarning.restore();
        });
    });
});

function createContext(values) {
    var getKeywordsSuccessfully = Q.defer(),
        getFrameworkCompatibilitySuccessfully  = Q.defer(),
        userAbandonsInstallation = Q.defer(),
        installSuccessfully = Q.defer();

    getKeywordsSuccessfully.resolve('adapt-extension');
    getFrameworkCompatibilitySuccessfully.resolve(values.pluginCompatibility);
    userAbandonsInstallation.resolve({ continueWithInstall: true });
    installSuccessfully.resolve(true);

    var stubs = {
        bower: {
            commands: {
                install: sinon.stub()
            }
        },
        renderer: { log: sinon.stub() },
        RendererHelpers: RendererHelpers,
        Project: Project,
        PackageMeta: {
            getKeywords: sinon.stub().returns(getKeywordsSuccessfully.promise),
            getFrameworkCompatibility: sinon.stub().returns(getFrameworkCompatibilitySuccessfully.promise)
        },
        install: sinon.stub().returns(installSuccessfully.promise)
    };

    sinon.stub(stubs.RendererHelpers, 'reportCompatibilityWarning').returns(userAbandonsInstallation.promise);
    sinon.stub(stubs.Project.prototype, 'getFrameworkVersion').returns(values.frameworkVersion);
    return stubs;
}

