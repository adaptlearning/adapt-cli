import bower from 'bower'

export function getKeywords (plugin, config) {
  return new Promise((resolve, reject) => {
    bower.commands.info(plugin.toString(), 'keywords', config || {})
      .on('end', resolve)
      .on('error', reject)
  })
}

export function getFrameworkCompatibility (plugin, config) {
  return new Promise(resolve => {
    const allVersions = '*'
    bower.commands.info(plugin.toString(), 'framework', config || {})
      .on('end', function (results) {
        resolve(results || allVersions)
      })
      .on('error', function () {
        resolve(allVersions)
      })
  })
}

export function getRepositoryUrl (plugin, config) {
  return new Promise((resolve, reject) => {
    bower.commands.lookup(plugin.name, config || {})
      .on('end', resolve)
      .on('error', reject)
  })
}
