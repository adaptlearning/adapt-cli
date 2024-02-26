import fs from 'fs-extra'
// import JSONLint from 'json-lint'

/**
 * @param {string} filepath
 * @param {function} [done]
 * @returns {Promise}
 */
export async function readValidateJSON (filepath, done) {
  try {
    const data = await fs.readFile(filepath, 'utf8')
    validateJSON(data, filepath)
    done?.(null, JSON.parse(data))
    return JSON.parse(data)
  } catch (err) {
    done?.(err.message)
  }
}

export function readValidateJSONSync (filepath) {
  const data = fs.readFileSync(filepath, 'utf-8')
  validateJSON(data, filepath)
  return JSON.parse(data)
}

function validateJSON (jsonData, filepath) {
  JSON.parse(jsonData)
  /*
  const lint = JSONLint(jsonData)
  if (!lint.error) return
  let errorMessage = 'JSON parsing error: ' + lint.error + ', line: ' + lint.line + ', character: ' + lint.character
  if (filepath) {
    errorMessage += ', file: \'' + filepath + '\''
  }
  throw new Error(errorMessage)
  */
}
