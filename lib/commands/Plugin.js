var Plugin = function(name, packageName) {
	this.name = name;
	this.packageName = packageName || 'adapt-' + name;
};
Plugin.prototype.toString = function() {
	return this.packageName;
};

module.exports = Plugin;