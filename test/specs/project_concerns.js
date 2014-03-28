var sinon = require('sinon'),
    expect = require('expect.js'),
    fs = require('fs'),
    Project = require('../../lib/Project'),
    Plugin = require('../../lib/Plugin');
    
describe('Given I have an adapt.json project file with no installed plugins', function () {

    describe('when I list all plugins', function () {
        it('should provide an empty list', function () {
            var project = new Project();
            expect(project.plugins).to.be.an(Array);
            expect(project.plugins.length).to.be(0);
        });
    });
    
});

describe('Given I have an adapt.json project file with plugins', function () {

    describe('when I list all plugins', function () {
        before(function () {
            fs.writeFileSync('./test/fixtures/adapt-when-i-list-plugins.json', JSON.stringify(require('../fixtures/adapt-with-plugins.json')));
        });

        it('should provide a list of all plugins', function () {
            var project = new Project('./test/fixtures/adapt-when-i-list-plugins.json');
            expect(project.plugins).to.be.an(Array);
            expect(project.plugins.length).to.be(2);
            expect(project.plugins[0].packageName).to.be('adapt-component');
            expect(project.plugins[0].version).to.be('0.0.1');
            expect(project.plugins[1].packageName).to.be('adapt-extension');
            expect(project.plugins[1].version).to.be('0.0.2');
        });

        after(function () {
            fs.unlinkSync('./test/fixtures/adapt-when-i-list-plugins.json');
        });
    });

    describe('when I add a plugin', function () {
        before(function () {
            fs.writeFileSync('./test/fixtures/adapt-when-I-add-a-plugin.json', JSON.stringify(require('../fixtures/adapt-with-plugins.json')));
        });

        it('should provide a list with the new plugins', function () {
            var project = new Project('./test/fixtures/adapt-when-I-add-a-plugin.json');
            project.add(new Plugin('theme', '0.0.3'));
            expect(project.plugins).to.be.an(Array);
            expect(project.plugins.length).to.be(3);
            expect(project.plugins[0].packageName).to.be('adapt-component');
            expect(project.plugins[0].version).to.be('0.0.1');
            expect(project.plugins[1].packageName).to.be('adapt-extension');
            expect(project.plugins[1].version).to.be('0.0.2');
            expect(project.plugins[2].packageName).to.be('adapt-theme');
            expect(project.plugins[2].version).to.be('0.0.3');
        });

        after(function () {
            fs.unlinkSync('./test/fixtures/adapt-when-I-add-a-plugin.json');
        });
    });

    describe('when I remove a plugin', function () {
        before(function () {
            fs.writeFileSync('./test/fixtures/adapt-when-i-remove-a-plugin.json', JSON.stringify(require('../fixtures/adapt-with-plugins.json')));
        });

        it('should no longer contain that plugin', function () {
            var project = new Project('./test/fixtures/adapt-when-i-remove-a-plugin.json');
            project.remove(new Plugin('component'));
            expect(project.plugins.length).to.be(1);
            expect(project.plugins[0].packageName).to.be('adapt-extension');
            expect(project.plugins[0].version).to.be('0.0.2');
        });

        after(function () {
            fs.unlinkSync('./test/fixtures/adapt-when-i-remove-a-plugin.json');
        });  
    });
    
});

describe('Given I have not got an adapt.json project file', function () {

    describe('when I add a plugin', function () {
        before(function () {
            if(fs.existsSync('./test/fixtures/adapt-missing.json')) {
                fs.unlinkSync('./test/fixtures/adapt-missing.json');
            }
        });

        it('should create the file', function () {
            var project = new Project('./test/fixtures/adapt-missing.json');
            project.add(new Plugin('theme', '0.0.3'));

            expect(fs.existsSync(project.manifestFilePath)).to.be(true);
            
            var created = new Project('./test/fixtures/adapt-missing.json')
            expect(created.plugins.length).to.be(1);
            expect(created.plugins[0].packageName).to.be('adapt-theme');
            expect(project.plugins[0].version).to.be('0.0.3');
        });

        after(function () {
            fs.unlinkSync('./test/fixtures/adapt-missing.json');
        });
    });
    
});