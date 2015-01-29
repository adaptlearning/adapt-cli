define(function (require) {

    var Backbone = require('backbone'),
        _ = require('underscore'),
        sinon = require('sinon') || window.sinon;

    function addCourse(course) {
        _.extend(this.stubbed.course, course);
        return this;
    }

    function addConfig(config) {
        _.extend(this.stubbed.config, config);
        return this;
    }

    function addComponent(component) {
        this.stubbed.components.push(component);
        return this;
    }

    function createView() {
        return new Backbone.View();
    }

    function createModel(properties, stubs) {
        stubs = stubs || _.pick(properties, _.functions(properties));
        properties = _.omit(properties, _.functions(properties));

        var AdaptModel = Backbone.Model.extend({
            initialize: sinon.stub(),
            init: sinon.stub(),
            checkReadyStatus: sinon.stub(),
            checkCompletionStatus: sinon.stub(),
            findAncestor: stubs.findAncestor || sinon.stub().returns(new Backbone.Collection()),
            findDescendants: stubs.findDescendants || sinon.stub().returns(new Backbone.Collection()),
            getChildren: stubs.getChildren || sinon.stub().returns(new Backbone.Collection()),
            getParent: stubs.getParent || sinon.stub().returns(new Backbone.Model()),
            getSiblings: stubs.getSiblings || sinon.stub().returns(new Backbone.Collection()),
            setOnChildren: sinon.stub()
        });

        return new AdaptModel(properties);
    }

    function createCollection(items, stubs) {
        var Collection = Backbone.Collection.extend(stubs);
        return new Collection(items);
    }

    function setup (proxy) {
        if('function' === typeof proxy) {
            proxy.call(this.stubbed, this);
        }
        return this;
    }

    function create() {
        this.stubbed.course = createModel(this.stubbed.course);
        this.stubbed.articles = createCollection(this.stubbed.articles);
        this.stubbed.blocks = createCollection(this.stubbed.blocks);
        this.stubbed.components = createCollection(this.stubbed.components);
        this.stubbed.config = createModel(this.stubbed.config);
        this.stubbed.register = sinon.stub();
        return _.extend({}, Backbone.Events, this.stubbed);
    }

    return {
        stubbed: {
            config: {},
            course: {},
            articles: [],
            blocks: [],
            components: []
        },
        stub: function () {
            return sinon.stub();
        },
        addCourse: addCourse,
        addConfig: addConfig,
        addComponent: addComponent,
        createModel: createModel,
        createView: createView,
        setup: setup,
        create: create
    };

});