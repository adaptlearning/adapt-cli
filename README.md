Adapt Command Line Interface
============================

[![Build Status](https://travis-ci.org/adaptlearning/adapt-cli.png?branch=master)](https://travis-ci.org/adaptlearning/adapt-cli)

Installation
------------

To install the Adapt CLI, first be sure to install [NodeJS](http://nodejs.org), then from the command line run:-


		npm install -g adapt-cli


Usage
-----

##### Searching for an Adapt plugin.

	adapt search {name or partial name of plugin to search for}


##### Installing a plugin into your current directory

	adapt install {name of plugin}

Anywhere that you are required to provide a name of a plugin it can be either fully qualified with 'adapt-' or optionally you can omit the prefix an just use the plugin name.

Therefore these commands are equivalent:

    adapt install adapt-my-plugin
    adapt install my-plugin

Installed plugins are saved to `adapt.json`. 

##### Installing plugins previously saved in adapt.json

    adapt install


##### Uninstalling a plugin from your current directory

    adapt uninstall {name of plugin}


The Plugin Registry
-------------------

The plugin system is powered by [Bower](http://bower.io/). Each plugin should be a valid bower package and they should be registered with the Adapt registry.

    http://adapt-bower-repository.herokuapp.com/packages/

See [Developing plugins](https://github.com/adaptlearning/adapt_framework/wiki/Developing-plugins) for more information on defining your plugins package.

##### Registering a plugin

From within a plugin directory

    adapt register

`name` and `repository` will be read from `bower.json` in the current directory.

The package will be registered with the registry on a first come first serve basis.