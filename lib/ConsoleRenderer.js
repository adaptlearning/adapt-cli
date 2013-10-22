var chalk = require('chalk');

module.exports = {
	log: function () {
		console.log.apply(this, arguments);
	}
};