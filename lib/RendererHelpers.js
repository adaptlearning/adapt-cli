module.exports = {
     reportFailure : function (renderer, done) {
        return function (err) {
            renderer.log(chalk.red('Oh dear, something went wrong.'), err.message);
            done(err);
        };
    }
}