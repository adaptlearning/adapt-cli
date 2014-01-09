var mockery = require('mockery'),
    sinon = require('sinon'),
    expect = require('expect.js'),
    Q = require('q'),
    Project = require('../../lib/Project'),
    Plugin = require('../../lib/Plugin');

describe('Given I have an uninstall command', function () {
    describe('when I uninstall a plugin', function () {
        var bower = {
                commands: {}
            }
            PackageMeta = {
            }, 
            renderer =  {
                log: sinon.stub()
            };

        before(function () {
            mockery.enable();
            mockery.warnOnUnregistered(false)
            
            bower.commands.uninstall = sinon.stub().returns({
                on: function (event, done) {
                    if(event === 'end') {
                        setTimeout(done, 10, true)    
                    }
                    return this;
                }
            });
            mockery.registerMock('bower', bower);
            
            PackageMeta.getKeywords = sinon.stub().returns(Q.fcall(function () {
                return ['adapt-component'];
            }));
            mockery.registerMock('../PackageMeta', PackageMeta);
        });

        it('should get the keywords', function (done) {
            var command = require('../../lib/commands/uninstall');
            command.uninstall(renderer, 'my-plugin', function () {
                expect(PackageMeta.getKeywords.called).to.be(true);
                done();
            });
        });

        it('should invoke the bower uninstall command', function (done) {
            var command = require('../../lib/commands/uninstall');
            command.uninstall(renderer, 'my-plugin', function () {
                expect(bower.commands.uninstall.called).to.be(true);
                done();
            });
        });

        after(function () {
            mockery.disable();
        })
    });
    
});