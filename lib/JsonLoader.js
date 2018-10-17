var fs = require('fs'),
    JSONLint = require('json-lint');

module.exports = {
    existsSync: fs.existsSync,

    exists: fs.exists,

    readJSON: function (filepath, done) {
        done = done || function () {};

        fs.readFile(filepath, 'utf8', function (err, data) {
            if(err) return done(err);

            try {
                validateJSON(data, filepath);
                done(null, JSON.parse(data));
            } catch (ex) {
                done(ex.message);
            }
        });
    },

    readJSONSync: function (filepath) {
        var data = fs.readFileSync(filepath, 'utf-8');
        validateJSON(data, filepath);
        return JSON.parse(data);
    }
};

function validateJSON(jsonData, filepath) {
    var lint = JSONLint(jsonData);
    if (lint.error) {
        var errorMessage = 'JSON parsing error: ' + lint.error + ', line: ' + lint.line + ', character: ' + lint.character;
        if(filepath) {
            errorMessage += ', file: \'' + filepath + '\'';
        }
        throw new Error(errorMessage);
    }
}
