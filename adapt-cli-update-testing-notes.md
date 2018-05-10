### Instructions for testing the adapt-cli update command

- Use the current LTS version of Node (v8.11.1) as per the [guidance](https://github.com/adaptlearning/adapt_framework/wiki/Setting-up-your-development-environment). Don’t forget to have `grunt` and `adapt-cli` installed globally (`npm install –g grunt-cli adapt-cli`) when you install a new version of Node.
- Clone [chris-steele/adapt-cli](https://github.com/chris-steele/adapt-cli), checkout the develop branch and then run `npm install` in this directory.
- Download one of the Adapt framework releases (https://github.com/adaptlearning/adapt_framework/releases) and place it in the same directory that contains the `adapt-cli` you just cloned. Switch to this directory and run `npm install`.
- In the same directory create a file named `adapt-dev.js` and place the following code inside it:

```
#!/usr/bin/env node
var cli = require('../adapt-cli/lib/cli');
cli.withOptions().withPackage().execute();
```

- Observe the entries in the `adapt.json` manifest and run `adapt install`.
- At this point you may find it useful to add the contents of the Adapt installation to version control so that as you test the functionality you will be able to see easily any changes made to the file system and also be able to revert changes and test alternative commands.
- Run `node adapt-dev.js help update` for guidance using the update command and for command syntax.
- Now run `node adapt-dev.js update`. If you installed the latest version of the framework there should not have been any changes to the installed plugins.
- Attempt to install different versions of various plugins; either by directly specifying them via the `update` command or by editing the manifest and again run `node adapt-dev.js update`. Observe the changes (if any).
- Explore different scernarios; for example updating multiple plugins or groups of plugins together, try different semver ranges and also try the above with older versions of the Adapt framework.

### Important Notes

The outcome of an update command ensures that all updated plugins reflect the requested versions held on the server. As such any local changes will be overwritten.

Using `adapt install` will potentially modify the manifest. If a given version of a plugin is specified this will be written to the manifest, otherwise the wildcard `*` will be written. The `update` command does **not** modify the manifest.

The update command does not check to see whether there is a _later compatible version_. It is the _latest_ version of a plugin that is considered. If it is not compatible with the project framework then the user is given the option of proceeding with the update or skipping it. There is an exception to this behaviour and that is if a semver range is given; either via the command line or in the manifest. For example, if the project framework is `2.1.3` and the manifest specifies `adapt-contrib-media` with semver range `2.1.*` with `2.1.0` currently installed then running `update` will install `2.1.1`. If, on the other hand, the semver range specified `*` then the `update` command would determine that `3.0.0` is the latest version of `adapt-contrib-media` and warn the user of the incompatibility with the framework; because this version requires framework `3.0.0` or later. The update command is unaware of the later compatible version; viz. `v2.1.1`.

### Issue logging

Log issues to the adapt-cli [issue list](https://github.com/adaptlearning/adapt-cli/issues) on GitHub. Please check the list before submission to see if the issue has already been reported.

As always please report any problems with full steps to reproduce; including what version of Adapt you are using, list of plugins being updated (giving current and target version numbers), the update command, the environment (platform, version of Node etc) and of course the error (with stack trace if available).