
var delimiter = ',',
    CommandParser = function (argv) {
        argv = argv || ['node', 'path'];
        this.parameters = argv.slice(2);
        if(this.parameters.length) {
            this.name = String.prototype.toLowerCase.call(this.parameters.shift());
        }
    };

CommandParser.prototype.param = function (index) {
    if(index >= this.parameters.length)
        return undefined;

    return this.parameters[index];
};

module.exports = CommandParser;