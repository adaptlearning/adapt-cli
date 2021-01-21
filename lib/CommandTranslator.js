var _ = require('lodash'),
    translationTable = [
        { pattern: /^-v$|^--version$/i, replacement: 'version' },
        { pattern: /^upgrade$/i, replacement: 'update' }
    ],
    CommandTranslator = function (parameters) {
        parameters = Array.isArray(parameters) ? parameters : [parameters];
        return parameters.map(function (param) {
            var translation = _.find(translationTable, function (item) {
                return item.pattern.test(param);
            });
            return translation ? translation.replacement : param;
        });
    };

module.exports = CommandTranslator;
