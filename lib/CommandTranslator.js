const translationTable = [
  { pattern: /^-v$|^--version$/i, replacement: 'version' },
  { pattern: /^upgrade$/i, replacement: 'update' }
]
const CommandTranslator = function (parameters) {
  parameters = Array.isArray(parameters) ? parameters : [parameters]
  return parameters.map(function (param) {
    const translation = translationTable.find(function (item) {
      return item.pattern.test(param)
    })
    return translation ? translation.replacement : param
  })
}

export default CommandTranslator
