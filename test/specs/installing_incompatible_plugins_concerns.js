var sinon = require('sinon'),
    expect = require('expect.js');

describe('Given that I have Adapt Framework version 2', function () {
    describe('When I install a plugin that is tagged as incompatible with Adapt V2 framework version', function () {
        it('should warn that the plugin is incompatible');
    });

    describe('When I install a plugin that is not tagged with a framework version', function () {
        it('should warn that the plugin is incompatible');
    });
});

describe('Given that I have Adapt Framework version 1.1.1 or earlier', function () {
    describe('When I install a plugin that is tagged as compatible with Adapt V2 framework version', function () {
        it('should warn that the plugin is incompatible');
    });
});