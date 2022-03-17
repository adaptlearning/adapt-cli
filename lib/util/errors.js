export default {
  ERROR_COURSE_DIR: {
    code: 0,
    message: 'Commands must be run in an Adapt project directory'
  },
  ERROR_INCOMPATIBLE_VALID_REQUEST: {
    code: 1,
    message: 'No compatible version exists (requested version is valid)'
  },
  ERROR_INCOMPATIBLE_BAD_REQUEST: {
    code: 2,
    message: 'No compatible version exists (requested version is invalid)'
  },
  ERROR_INCOMPATIBLE: {
    code: 3,
    message: 'No compatible version exists'
  },
  ERROR_COMPATIBLE_INC_REQUEST: {
    code: 4,
    message: 'Incompatible version requested (compatible version exists)'
  },
  ERROR_COMPATIBLE_BAD_REQUEST: {
    code: 5,
    message: 'Requested version is invalid'
  },
  ERROR_UNINSTALL: {
    code: 6,
    message: 'The plugin could not be uninstalled'
  },
  ERROR_NOT_FOUND: {
    code: 7,
    message: 'The plugin could not be found'
  },
  ERROR_NOTHING_TO_UPDATE: {
    code: 8,
    message: 'Could not resolve any plugins to update'
  },
  ERROR_UPDATE_INCOMPATIBLE: {
    code: 9,
    message: 'Incompatible update requested'
  },
  ERROR_INSTALL_ERROR: {
    code: 10,
    message: 'Unknown installation error'
  },
  ERROR_UPDATE_ERROR: {
    code: 11,
    message: 'Unknown update error'
  },
  ERROR_NO_RELEASES: {
    code: 12,
    message: 'No published releases'
  },
  ERROR_NO_UPDATE: {
    code: 13,
    message: 'No update available'
  }
}
