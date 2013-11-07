var PluginTypeResolver = function(types) {
        this.types = types || [
            {
                pattern: /^adapt-component$/,
                typename: 'component',
                belongsTo: 'components'
            },
            {
                pattern: /^adapt-extension$/,
                typename: 'extension',
                belongsTo: 'extensions'
            },
            {
                pattern: /^adapt-menu$/,
                typename: 'menu',
                belongsTo: 'menu'
            },
            {
                pattern: /^adapt-theme$/,
                typename: 'theme',
                belongsTo: 'theme'
            }
        ];
        this.defaultType = this.types[0];
};
PluginTypeResolver.prototype.resolve = function (keywords) {
    keywords = Array.isArray(keywords) ? keywords : [keywords];

    var types = keywords.map(toType(this.types))
                        .filter(NonMatchingKeywords);

    return  (types.length ? types[0] : this.defaultType);
};
module.exports = PluginTypeResolver;

function toType(types) {
    return function (keyword) {
        var typematches = types.filter(function (type) {
            return type.pattern.test(keyword);
        });
        if(typematches.length) return typematches[0];
    }
}

function NonMatchingKeywords(item) {
    return item !== undefined
}