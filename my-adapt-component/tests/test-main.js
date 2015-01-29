var tests = [];
for (var file in window.__karma__.files) {
    if (/spec\//.test(file)) {
        tests.push(file);
    }
}

requirejs.config({
    baseUrl: '/base/js',
    paths: {
        jquery: '../tests/libraries/jquery-min',
        underscore: '../tests/libraries/underscore-min',
        backbone: '../tests/libraries/backbone-min',
        sinon: '../tests/libraries/sinon',
        contextFactory: '../tests/libraries/contextFactory',
        AdaptMock: '../tests/libraries/AdaptMock'
    },
    shim: {
        jquery: [],
        backbone: {
            deps: [
                'underscore',
                'jquery'
            ],
            exports: 'Backbone'
        },
        underscore: {
            exports: '_'
        },
        handlebars: {
            exports: 'Handlebars'
        }
    },
    deps: tests,
    callback: window.__karma__.start
});
