var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have a name', function () {
    var Plugin  = require('../../lib/Plugin');
            
    describe('when I create a plugin from a package name', function () {
        it('should prefix the name with "adapt"', function () {
            var plugin = new Plugin('package');
            expect(plugin.packageName).to.match(/^adapt-package$/);
        });

        it('should default the version to "*"', function () {
            var plugin = new Plugin('package');
            expect(plugin.version).to.match(/^\*$/);
        });

        it('should stringify to the bower endpoint', function () {
            var plugin = new Plugin('package');
            expect(plugin.toString()).to.match(/^adapt-package$/);
        });
    });

    describe('when I create a plugin from a multiple word package name', function () {
        it('should convert the name to a suitable name with hyphens', function () {
            var plugin = new Plugin('my adapt package');
            expect(plugin.packageName).to.match(/^adapt-my-adapt-package$/);
        });
    });

    describe('when I create a plugin from a specific version package name', function () {
        it('should parse the correct version', function () {
            var plugin = new Plugin('package' ,'1.0.0');
            expect(plugin.packageName).to.match(/^adapt-package$/);
            expect(plugin.version).to.match(/^1.0.0$/);
        });

        it('should stringify to the bower endpoint', function () {
            var plugin = new Plugin('package', '1.0.0');
            expect(plugin.toString()).to.match(/^adapt-package#1.0.0$/);
        });
    });

    describe('when I create a contrib plugin from a package name', function () {
        it('should be contrib', function () {
            var plugin = new Plugin('package', true);
            expect(plugin.isContrib).to.be(true);
        });

        it('should prefix the name with "adapt-contrib"', function () {
            var plugin = new Plugin('package', true);
            expect(plugin.packageName).to.match(/^adapt-contrib-/);
        });
    });

    describe('when I create a specific version of a contrib plugin from a package name', function () {
        it('should be contrib', function () {
            var plugin = new Plugin('package', '1.0.0', true);
            expect(plugin.isContrib).to.be(true);
        });

        it('should prefix the name with "adapt-contrib"', function () {
            var plugin = new Plugin('package', '1.0.0', true);
            expect(plugin.packageName).to.match(/^adapt-contrib-/);
        });
    });

    describe('when I create a plugin from a 0.0.0 version', function () {
        it('should support any version', function () {
            var plugin = new Plugin('package' ,'0.0.0');
            expect(plugin.packageName).to.match(/^adapt-package$/);
            expect(plugin.version).to.match(/^\*$/);
        });

        it('should stringify to the bower endpoint for any version', function () {
            var plugin = new Plugin('package', '0.0.0');
            expect(plugin.toString()).to.match(/^adapt-package$/);
        });
    });


});