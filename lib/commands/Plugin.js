var Plugin = function(name, packageName) {
    this.name = name;
    this.packageName = packageName || makePackageName(name);
};
Plugin.prototype.toString = function() {
	return ''+this.packageName;
};

function makePackageName(name) {
    return (/^adapt-/i.test(name) ? '' : 'adapt-') + name
}

module.exports = Plugin;