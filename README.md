Adapt Command Line Interface (CLI)
============================

[![Build Status](https://travis-ci.org/adaptlearning/adapt-cli.png?branch=master)](https://travis-ci.org/adaptlearning/adapt-cli)  [![Join the chat at https://gitter.im/adaptlearning/adapt-cli](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/adaptlearning/adapt-cli?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

The **Adapt CLI** is a command line interface for use with the [Adapt framework](https://github.com/adaptlearning/adapt_framework). Its primary usefulness is to install, update, and uninstall Adapt plug-ins. In doing so, it references the [Adapt Plugin Browser](https://www.adaptlearning.org/index.php/plugin-browser/). Consequently, the CLI includes several commands for working with this plug-in registry.

>IMPORTANT: The **Adapt CLI** is not intended to be used with courses in the [Adapt authoring tool](https://github.com/adaptlearning/adapt_authoring). The authoring tool tracks versions of plug-ins in its database. Using the CLI bypasses this tracking.

## Installation

Before installing the Adapt CLI, you must install [NodeJS](http://nodejs.org) and [git](http://git-scm.com/downloads).
To install the Adapt CLI globally, run the following command:

`npm install -g adapt-cli`

Some systems may require elevated permissions in order to install a script globally.


## Commands

### adapt version

##### Model:
`adapt version`

This command reports both the version of the CLI and the version of the Adapt framework. The version of the framework is reported as "0.0.0" unless the command is run from the root directory of an installed framework.
<div float align=right><a href="#top">Back to Top</a></div>

### adapt help

##### Model:
`adapt help [<command>]`

**command**: A CLI command.

##### Examples:

1. To list all the CLI commands with a brief description of each:
`adapt help`

1. To report a brief description of a specific command:
`adapt help create`

<div float align=right><a href="#top">Back to Top</a></div>

### adapt create

##### Model:
`adapt create [<type> <path> <branch|tag>]`

**type**: What to create. Acceptable values are `course` and `component`.
**path**: The directory of the new course. Enclose in quotes if the path/name includes spaces.
**branch|tag**: The branch or tag name of the framework to be downloaded. This is optional. If not specified, the master branch will be used.

##### Examples:

1. To create an Adapt course *(do not use in conjunction with the Adapt authoring tool)*:
`adapt create course "My Course"`
This will create a new directory named "My Course" in your current working directory. It will download the Adapt framework from its master branch, including the default course, into the new directory. Before using the course, run:
`grunt build`

1. To create an Adapt course from a specific branch:
`adapt create course "My Course" legacy`
This is the same as example 1 except that the framework will be downloaded from the 'legacy' branch, not from the default master branch.

1. To create an Adapt course from a specific tag:
`adapt create course "My Course" v3.5.1`
This is the same as example 1 except that v3.5.1 of the framework will be downloaded, rather than the master branch.

1. To create an empty component:
`adapt create component "test-component"`
This command is useful for developing new components. It will create a new directory named "test-component" in the current working directory. It will populate the directory with files required for an Adapt component and insert "test-component" into the code where required.
<div float align=right><a href="#top">Back to Top</a></div>

### adapt search

##### Model:
`adapt search [<plug-in>]`

**plug-in**: The optional name of the plug-in that you want to search for. Any part of the name may be used; multiple results may be returned if the partial name is not unique.

The **search** command searches within [Adapt Plugin Browser](https://www.adaptlearning.org/index.php/plugin-browser/). It will return the plug-in's complete name and its source repository only if the plug-in is registered.

##### Examples:
1. To view the name and repository of all plug-ins registered with the Adapt Plugin Browser:
`adapt search`

1. To locate the repository of a known plug-in that is registered:
`adapt search adapt-contrib-pageLevelProgress` OR
`adapt search contrib-pageLevelProgress` OR
`adapt search pageLevel`
<div float align=right><a href="#top">Back to Top</a></div>

### adapt install

##### Models:
`adapt install <plug-in>[#|@<version>]`
`adapt install [--dry-run|--compatible]`

**plug-in**: The name of the plug-in to be installed. The name may be fully qualified with "adapt-" or the prefix may be omitted. Parts of names are not acceptable.
**version**: A specific version number of the plug-in. This is optional.

##### Examples:
1. To install all plug-ins listed in *adapt.json*:
`adapt install`
This command must be run in the root directory of an Adapt framework installation.

1. To report the plug-ins that will be installed if `adapt install` is run:
`adapt install --dry-run`
This command must be run in the root directory of an Adapt framework installation.

1. To install versions of all plug-ins listed in *adapt.json* that are compatible with the installed framework version. This overrides any incompatible settings provided on the command line or in *adapt.json*.
`adapt install --compatible`
This command must be run in the root directory of an Adapt framework installation.

1. To install a plug-in that has been registered with the [Adapt Plug-in Browser](https://www.adaptlearning.org/index.php/plugin-browser/) registry:
`adapt install adapt-contrib-pageLevelProgress` OR
`adapt install contrib-pageLevelProgress`

1. To install a specific version of a registered plug-in:
`adapt install adapt-contrib-pageLevelProgress#1.1.0` OR
`adapt install adapt-contrib-pageLevelProgress@1.1.0` OR
`adapt install contrib-pageLevelProgress#1.1.0` OR
`adapt install contrib-pageLevelProgress@1.1.0`

1. To use the CLI to install a plug-in that is not registered with [Adapt Plug-in Browser](https://www.adaptlearning.org/index.php/plugin-browser/) registry:
    1. Copy the uncompressed folder to the proper location for the type of plug-in. Components: *src/components*. Extensions: *src/extensions*. Menu: *src/menu*. Theme: *src/theme*. Note: The Adapt framework allows only one theme. Uninstall the current before replacing it with an alternative. More than one menu is allowed.
    1. Open *adapt.json* in an editor and add the full name of the new component to the list.
    1. Run the following command from the course root:
    `adapt install`
After installation, most CLI commands will operate on the plug-in with the exception of `adapt update`. Plug-ins must be registered with the [Adapt Plugin Browser](https://www.adaptlearning.org/index.php/plugin-browser/) for `adapt update` to succeed.

1. To update all registered plug-ins to their most recent public release:
`adapt update`
Since no plug-in name is specified in this command, all plug-ins listed in *adapt.json* are reinstalled. Whether the plug-in is updated will be determined by the compatible framework versions specified in *adapt.json*.  If it includes a plug-in that is not registered, it will not be updated.
**Note to developers:** The CLI determines newest version by comparing release tags in the GitHub repo. Be sure to use a tag when you release a new version.
<div float align=right><a href="#top">Back to Top</a></div>

### adapt ls

##### Model:
`adapt ls`

This command lists the name and version number of all plug-ins listed in the *adapt.json* file of the current directory.
<div float align=right><a href="#top">Back to Top</a></div>

### adapt uninstall

##### Model:
`adapt uninstall <plug-in>`

**plug-in**: The name of the plug-in to be installed. The name may be fully qualified with "adapt-" or the prefix may be omitted. Parts of names are not acceptable.

##### Examples:
1. To uninstall a plug-in:
`adapt uninstall adapt-contrib-pageLevelProgress` OR
`adapt uninstall contrib-pageLevelProgress`
Because the plug-in registry is not referenced during the uninstall process, this command will work whether or not the plug-in is registered with the Adapt Plugin Browser..
<div float align=right><a href="#top">Back to Top</a></div>

### adapt devinstall

##### Model:
`adapt devinstall [<plug-in>[#<version>]]`

**plug-in**: Name of the plug-in to be cloned.
**version**: Version of the plug-in to be installed.

##### Examples:

1. To clone as git repositories the Adapt framework and all the plug-ins listed in *adapt.json* of the current directory:
`adapt devinstall`

1. To clone a specific plug-in listed in the *adapt.json*:
`adapt devinstall adapt-contrib-matching`

1. To clone a specific version of a plug-in listed in the *adapt.json*:
`adapt devinstall adapt-contrib-matching#v2.2.0`
<div float align=right><a href="#top">Back to Top</a></div>

### adapt update

##### Models:
`adapt update [<plug-in>[#|@<version>]][--check]`
`adapt update [components|extensions|menu|theme|all][--check]`

**plug-in**: Name of the plug-in to be cloned.
**version**: Version of the plug-in to be installed.
Before running the update command, ensure that there is no *bower.json* file in your project directory.

##### Examples:

1. To report the latest compatible version for each plug-in in the current directory (plug-ins are not updated):
`adapt update --check`
Note: The `--check` option may be used to report on a specific plug-in or on a complete plug-in group (components, extensions, theme, menu):
`adapt update adapt-contrib-matching --check`
`adapt update extensions --check`

1. To update a registered plug-in:
`adapt update adapt-contrib-pageLevelProgress` OR
`adapt update contrib-pageLevelProgress`

1. To update a specific version of a registered plug-in:
`adapt update adapt-contrib-pageLevelProgress#1.1.0` OR
`adapt update adapt-contrib-pageLevelProgress@1.1.0` OR
`adapt update contrib-pageLevelProgress#1.1.0` OR
`adapt update contrib-pageLevelProgress@1.1.0`
<div float align=right><a href="#top">Back to Top</a></div>

### adapt register

##### Command:
`adapt register`

This command must be run from within the root directory of the plug-in you want to register. "name" and "repository" will be read from *bower.json* in the current directory. The plug-in name must be prefixed with "adapt-" and each word separated with a hyphen (-). Plug-in names are checked against those already registered to avoid duplicates.
<div float align=right><a href="#top">Back to Top</a></div>

URL format must be of the form `https://github.com/<user>/<repo_name>.git`

### adapt rename

##### Command:
`adapt rename <current-name> <new-name>`

**current-name**: Name of the plug-in currently used in the plug-in registry.
**new-name**: Name proposed to replace the current plug-in name.

Please note that you must authenticate with GitHub to use **rename**. You must be a collaborator on the endpoint registered with the plug-in or a collaborator on the Adapt framework. Access to GitHub is for authentication only.

##### Example:

1. To rename a plug-in:
`adapt rename adapt-incorrectName adapt-betterName`
<div float align=right><a href="#top">Back to Top</a></div>

### adapt unregister

##### Command:
`adapt unregister [<plug-in>]`

**plug-in**: Name of the plug-in currently used in the plug-in registry.

Please note that you must authenticate with GitHub to use **unregister**. You must be a collaborator on the endpoint registered with the plug-in or a collaborator on the Adapt framework. Access to GitHub is for authentication only.

##### Examples:

1. To unregister a plug-in while in the root directory of the plug-in:
`adapt unregister`

1. To unregister a plug-in by name:
`adapt unregister adapt-myMistake`
<div float align=right><a href="#top">Back to Top</a></div>


The Plug-in Registry
-------------------

The Adapt community maintains the [Adapt Plugin Browser](https://www.adaptlearning.org/index.php/plugin-browser/) as a convenient registry of components, extensions, themes, and menus. The plug-in system is powered by [Bower](http://bower.io/): http://adapt-bower-repository.herokuapp.com/packages/. To register, a plug-in must be a valid bower package with *bower.json*, and have a unique name that is prefixed with "adapt-".

See [Developing plug-ins](https://github.com/adaptlearning/adapt_framework/wiki/Developing-plugins) for more information on defining your plug-in's package and on [registering your plug-in](https://github.com/adaptlearning/adapt_framework/wiki/Registering-a-plugin).
<div float align=right><a href="#top">Back to Top</a></div>

----------------------------
**Version number:**  3.0.1  <a href="https://community.adaptlearning.org/" target="_blank"><img src="https://github.com/adaptlearning/documentation/blob/master/04_wiki_assets/plug-ins/images/adapt-logo-mrgn-lft.jpg" alt="adapt learning logo" align="right"></a>
**Author / maintainer:** Adapt Core Team with [contributors](https://github.com/adaptlearning/adapt-contrib-hotgraphic/graphs/contributors)
