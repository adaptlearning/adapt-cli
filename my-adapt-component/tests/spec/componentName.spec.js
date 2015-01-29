define(['../libraries/AdaptMock.js', 'jquery', 'contextFactory'], function(AdaptMock, $, contextFactory) {

    var createContext = function () {
            return contextFactory({
                'coreJS/adapt': AdaptMock.create(),
                'coreViews/componentView': { extend: AdaptMock.stub() },
                'jquery': $
            });
        };

    describe('A component ...', function() {

        it('should register', function(done) {
            var context = createContext();
            context(['coreJS/adapt', 'adapt-contrib-componentName'], function (Adapt, plugin) {
                expect(Adapt.register.called).to.be(true);
                done();
            });
        });

    });

});