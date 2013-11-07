var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have a plugin type resolver', function () {
    var PluginTypeResolver = require('../../lib/PluginTypeResolver'),
        resolver = new PluginTypeResolver();
            
    describe('when I resolve the keyword for a component', function () {
        it('should provide a type of component', function () {
            var keywords = ['adapt-component'];

            expect(resolver.resolve(keywords).typename).to.be('component');
            expect(resolver.resolve(keywords).belongsTo).to.be('components');
        });
    });

    describe('when I resolve the keyword for an extension', function () {
        it('should provide a type of extension', function () {
            var keywords = ['adapt-extension'];

            expect(resolver.resolve(keywords).typename).to.be('extension');
            expect(resolver.resolve(keywords).belongsTo).to.be('extensions');
        });
    });

    describe('when I resolve the keyword for a menu', function () {
        it('should provide a type of menu', function () {
            var keywords = ['adapt-menu'];

            expect(resolver.resolve(keywords).belongsTo).to.be('menu');
            expect(resolver.resolve(keywords).belongsTo).to.be('menu');
        });
    });

    describe('when I resolve the keyword for a theme', function () {
        it('should provide a type of theme', function () {
            var keywords = ['adapt-theme'];

            expect(resolver.resolve(keywords).belongsTo).to.be('theme');
            expect(resolver.resolve(keywords).belongsTo).to.be('theme');
        });
    });

    describe('when I have no keywords', function () {
        it('should provide the default type', function () {
            var keywords = undefined;

            expect(resolver.resolve(keywords).typename).to.be(resolver.defaultType.typename);
            expect(resolver.resolve(keywords).belongsTo).to.be(resolver.defaultType.belongsTo);
        });
    });

    describe('when I have conflicting keywords', function () {
        it('should provide the first matching type', function () {
            var keywords = ['adapt-theme', 'adapt-extension'];

            expect(resolver.resolve(keywords).typename).to.be('theme');
            expect(resolver.resolve(keywords).belongsTo).to.be('theme');
        });
    });

    describe('when I have an unknown keyword', function () {
        it('should provide the first matching type', function () {
            var keywords = ['unknown-keyword', 'adapt-theme'];

            expect(resolver.resolve(keywords).typename).to.be('theme');
            expect(resolver.resolve(keywords).belongsTo).to.be('theme');
        });
    });

});