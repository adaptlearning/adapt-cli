### Instructions for testing the adapt-cli update command

- Use the current LTS version of Node (v8.11.1) as per the [guidance](https://github.com/adaptlearning/adapt_framework/wiki/Setting-up-your-development-environment). Don’t forget to have `grunt` installed globally (`npm install –g grunt-cli`) when you install a new version of Node.
- Install globally the latest pre-release of adapt-cli (`npm install -g adapt-cli@next`)
- Select an Adapt project to test against. At this point you may find it useful to add the contents of the Adapt installation to version control if you haven't already. This will allow you test the functionality and be able to see easily any changes made to the file system and also be able to revert changes and test alternative commands.
- Run `adapt help update` for guidance using the `update` command and for command syntax.
- Now run `adapt update`. If you installed the latest version of the framework together with all the latest plugins there should not have been any changes to the installed plugins and you will see a summary of your installed plugins.
- You can add the `--check` option to review installed plugins without making changes. For each plugin the output will give its name, the version installed and indicate whether the plugin can be updated.
- The update can be limited to specific plugins by providing their names, or to specific groups of plugins by specifying one or more of `components`, `extensions`, `menu`, `theme`.
- Attempt to install different versions of various plugins; e.g. `adapt update adapt-contrib-media@>=3`. Observe the changes (if any).
- Explore different scenarios; for example updating multiple plugins or groups of plugins together, try different semver ranges and also try the above with older versions of the Adapt framework.

### Important Notes

The outcome of an `update` command ensures that all updated plugins reflect the requested versions held on the server. As such **any local changes will be overwritten**.

The `update` command does **not** use or modify the Adapt manifest (`adapt.json`).

Occasionally the command may report that one or more plugins cannot be found at the repository. This is a known limitation. The command will attempt to query the repository mulitple times before giving up. The issue is usually resolved by running the command again.

### Issue logging

Log issues to the adapt-cli [issue list](https://github.com/adaptlearning/adapt-cli/issues) on GitHub. Please check the list before submission to see if the issue has already been reported.

As always please report any problems with full steps to reproduce; including what version of Adapt you are using, list of plugins being updated (giving current and target version numbers), the `update` command, the environment (platform, version of Node etc) and of course the error (with stack trace if available).
