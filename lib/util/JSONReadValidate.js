import fs from 'fs-extra'
import parseJson from 'json-parse-even-better-errors'

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
  try {
    parseJson(jsonData)
  } catch (err) {
    const msg = filepath
      ? `${err.message} in file '${filepath}'`
      : err.message
    throw new Error(msg)
  }
}
