var _ = require('lodash');

module.exports = _.extend({},
	require('./search'),
    require('./install'),
    require('./uninstall')
);