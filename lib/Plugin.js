var slug = require('slug'),
    endpointParser = require('bower-endpoint-parser'),
    zero = '0.0.0';

var Plugin = function(name, versionOrIsContrib, isContrib) {
    this.name = name;

    if(typeof isContrib === 'undefined') {
        isContrib = false;
    }
    if(typeof versionOrIsContrib === 'undefined') {
        isContrib = false;
        this.version = zero;
    } else if(typeof versionOrIsContrib === 'boolean'){
        isContrib = versionOrIsContrib;
        this.version = zero;
    } else {
        this.version = versionOrIsContrib;
    }
    this.packageName = makePackageName(name, isContrib);

    Object.defineProperty(this, 'isContrib', {
        get: function () {
            return /^adapt-contrib/.test(this.packageName);
        }
    });
};

Plugin.prototype.toString = function() {
    var version = '';
    if(this.version !== zero) {
        version = '#'+ this.version;
    }
    return ''+this.packageName + version;
};

function makePackageName(name, isContrib) {
    return (/^adapt-/i.test(name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(name);
}

Plugin.parse = function (endpoint) {
    var ep = endpointParser.decompose(endpoint),
        version = /^\*$/.test(ep.target) ? zero : ep.target;
    return new Plugin(ep.name || ep.source, version);
};

Plugin.compose = function (endpoint) {
    return Plugin.parse(endpointParser.compose(endpoint));
};

module.exports = Plugin;