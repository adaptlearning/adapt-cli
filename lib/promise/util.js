var Q = require('q');

module.exports = {
    serialise: function (arr, iterator) {
        // create a empty promise to start our series (so we can use `then`)
        var currentPromise = Q();
        var promises = arr.map(function (el) {
            return currentPromise = currentPromise.then(function () {
                // execute the next function after the previous has resolved successfully
                return iterator(el)
            })
        });
        // group the results and return the group promise
        return Q.all(promises)
    }
};