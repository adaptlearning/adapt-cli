Adapt Command Line Interface
============================

Installation
------------

To install the Adapt CLI, first be sure to install [NodeJS](http://nodejs.org), then from the command line run:-


		npm install -g adapt-cli


Usage
-----

Searching for an Adapt plugin.

	adapt search {name or partial name of plugin to search for}


Installing a plugin into your current directory

	adapt install {name of plugin}

Uninstalling a plugin from your current directory

    adapt uninstall {name of plugin}

Anywhere that you aere required to provide a name of a plugin it can be either fully qualified with 'adapt-' or optionally you can omit the prefix an just use the plugin name.
Therefore these commands are equivalent:

    adapt install adapt-my-plugin
    adapt install my-plugin


The Plugin Registry
-------------------

The plugin system is powered by [Bower](http://bower.io/). Each plugin should be a valid bower package and they should be registered with the Adapt registry.

    http://adapt-bower-repository.herokuapp.com/packages/

Plugins must be registered with the name prefixed with 'adapt-' in order to find them.

Tag your plugin package with the appropriate keywords in order to get it to appear correctly.

* *adapt-component*
* *adapt-extension*
* *adapt-menu*
* *adapt-theme*
