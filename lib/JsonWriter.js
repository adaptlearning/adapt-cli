var fs = require('fs');

module.exports = {
    existsSync: fs.existsSync,

    exists: fs.exists,

    writeJSON: function (filepath, values, done) {
        done = done || function () {};

        fs.writeFile(filepath, JSON.stringify(values, null, 4), { encoding: 'utf8' }, function (err) {
            if(err) return done(err);

            done();
        });
    },

    writeJSONSync: function (filepath, values) {
        return fs.writeFileSync(filepath, JSON.stringify(values, null, 4), { encoding: 'utf8' });
    }
}
