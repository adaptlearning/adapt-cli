var slug = require('speakingurl');
module.exports = function (name) {

    return slug(name, { maintainCase: true })
};