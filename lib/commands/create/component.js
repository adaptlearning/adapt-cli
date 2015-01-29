var chalk = require('chalk'),
    Q = require('q'),
    getRepository = require('../../promise/getRepository'),
    removeTemporaryDownload = require('../../promise/removeTemporaryDownload'),
    replaceTextContent = require('../../promise/replaceTextContent'),
    Constants = require('../../Constants');

module.exports = function (properties) {
    var path = require('path');
    properties.component = {
        name: properties.localDir,
        files: [path.join(properties.localDir,'bower.json')]
    };
    if(addComponentToCurrentCourse()) {
        properties.localDir = 'src/components/' + properties.componentName;
    }
    return createComponent(properties);
};

function addComponentToCurrentCourse() {
    var fs = require('fs');
    return fs.existsSync('./adapt.json');
}

function createComponent(properties) {
    properties.repository = Constants.ComponentRepository;
    properties.repositoryName = Constants.ComponentRepositoryName;
    return getRepository(properties)
            .then(removeTemporaryDownload)
            .then(renameFiles)
            .then(renameVariables);
}

function renameFiles(properties) {
    var fs = require('fs'),
        path = require('path');

    var files = [
        { match: 'js/adapt-contrib-componentName.js', replace: /contrib-componentName/ },
        { match: 'less/componentName.less', replace: /componentName/ },
        { match: 'templates/componentName.hbs', replace: /componentName/ }
    ];
    var renameFiles = files.map(function (file) {
        return {
            from: path.join(properties.localDir, file.match),
            to: path.join(properties.localDir, file.match.replace(file.replace, properties.component.name))
        };
    });
    renameFiles.forEach(function (file) {
        fs.renameSync(file.from, file.to);
        properties.component.files.push(file.to);
    });
    return properties;
}

function renameVariables(properties) {
    var renameFileContentPromises = properties.component.files.map(function (file) {
        return replaceTextContent(file, (/((contrib-)?componentName)/g), properties.component.name);
    });
    return Q.all(renameFileContentPromises).then(function () {
        return properties;
    });
}