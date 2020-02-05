module.exports = {
    ERROR_COURSE_DIR: {
      code: 0,
      msg: "Commands must be run in an Adapt project directory"
    },
    ERROR_INCOMPATIBLE_VALID_REQUEST: {
      code: 1,
      msg: "No compatible version exists (requested version is valid)"
    },
    ERROR_INCOMPATIBLE_BAD_REQUEST: {
      code: 2,
      msg: "No compatible version exists (requested version is invalid)"
    },
    ERROR_INCOMPATIBLE: {
      code: 3,
      msg: "No compatible version exists"
    },
    ERROR_COMPATIBLE_INC_REQUEST: {
      code: 4,
      msg: "Incompatible version requested (compatible version exists)"
    },
    ERROR_COMPATIBLE_BAD_REQUEST: {
      code: 5,
      msg: "Requested version is invalid"
    },
    ERROR_UNINSTALL: {
      code: 6,
      msg: "The plugin could not be uninstalled"
    },
    ERROR_NOT_FOUND: {
      code: 7,
      msg: "The plugin could not be found"
    },
    ERROR_NOTHING_TO_UPDATE: {
      code: 8,
      msg: "Could not resolve any plugins to update"
    },
    ERROR_UPDATE_INCOMPATIBLE: {
      code: 9,
      msg: "Incompatible update requested"
    }
}