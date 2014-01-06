var fs = require('fs');

module.exports = {
    existsSync: fs.existsSync,

    exists: fs.exists,

    readJSON: function (filepath, done) {
        done = done || function () {};
                 
        fs.readFile(filepath, 'utf8', function (err, data) {
          if(err) return done(err);
         
          done(JSON.parse(data));
        });
    },

    readJSONSync: function (filepath) {
        return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    }
}
    