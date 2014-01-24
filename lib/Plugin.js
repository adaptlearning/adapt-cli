var slug = require('slug');

var Plugin = function(name, packageNameOrContrib) {
    this.name = name;
    if(typeof packageNameOrContrib === 'boolean') {
        this.packageName = makePackageName(name, true);
    } else {
        this.packageName = packageNameOrContrib || makePackageName(name, false);
    } 
    
    Object.defineProperty(this, 'isContrib', {
        get: function () {
            return /^adapt-contrib/.test(this.packageName);
        }
    });
};
Plugin.prototype.toString = function() {
	return ''+this.packageName;
};

function makePackageName(name, isContrib) {
    return (/^adapt-/i.test(name) ? '' : 'adapt-') + (!isContrib ? '' : 'contrib-') + slug(name);
}

module.exports = Plugin;