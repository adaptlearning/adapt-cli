var chalk = require('chalk'),
    Q = require('q'),
    getRepository = require('../../promise/getRepository'),
    removeTemporaryDownload = require('../../promise/removeTemporaryDownload'),
    replaceTextContent = require('../../promise/replaceTextContent'),
    slug = require('../../Slug'),
    Constants = require('../../Constants');

module.exports = function (properties) {
    var fs = require('fs'),
        path = require('path');

    properties.component = {
        name: slug(properties.localDir),
        files: []
    };
    properties.relative = function (file) {
        return path.join(this.localDir, file);
    };

    if(addComponentToCurrentCourse()) {
        var componentsDirectory = 'src/components';
        properties.localDir = path.join(componentsDirectory, properties.localDir);
        if(!fs.existsSync(componentsDirectory)) fs.mkdirSync(componentsDirectory);
    }
    properties.component.files.push(properties.relative('bower.json'));

    return createComponent(properties)
            .then(function (properties) {
                properties.renderer.log('\n' + chalk.green(properties.localDir), 'has been created.\n');

                if(addComponentToCurrentCourse()) {
                    properties.renderer.log(chalk.grey('To use this component in your course, use the registered name:') + chalk.yellow(properties.component.name));
                }
            });
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
            from: properties.relative(file.match),
            to: properties.relative(file.match.replace(file.replace, properties.component.name))
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