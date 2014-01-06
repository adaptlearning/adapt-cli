var sinon = require('sinon'),
    expect = require('expect.js');
    
describe('Given I have a name', function () {
    var Plugin  = require('../../lib/Plugin');
            
    describe('when I create a plugin from a package name', function () {
        it('should prefix the name with "adapt"', function () {
            
            var plugin = new Plugin('package');
            expect(plugin.packageName).to.match(/^adapt-package$/);
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

});