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
    // Extract line, column, and error description from error message
    // Format: "Error description at position X (line Y column Z) while parsing..."
    const match = err.message.match(/^(.+?) at position \d+ \(line (\d+) column (\d+)\)/)
    const errorDescription = match ? match[1] : err.message
    const line = match ? match[2] : 'unknown'
    const character = match ? match[3] : 'unknown'

    let errorMessage = 'JSON parsing error: ' + errorDescription + ', line: ' + line + ', character: ' + character
    if (filepath) {
      errorMessage += ', file: \'' + filepath + '\''
    }
    throw new Error(errorMessage)
  }
}
