
class TYPE {
  constructor ({ pattern, typename, belongsTo }) {
    this.pattern = pattern
    this.typename = typename
    this.belongsTo = belongsTo
  }
}

/** @type {<TYPE>} */
export const TYPES = [
  new TYPE({
    pattern: /^adapt-component$/,
    typename: 'component',
    belongsTo: 'components'
  }),
  new TYPE({
    pattern: /^adapt-extension$/,
    typename: 'extension',
    belongsTo: 'extensions'
  }),
  new TYPE({
    pattern: /^adapt-menu$/,
    typename: 'menu',
    belongsTo: 'menu'
  }),
  new TYPE({
    pattern: /^adapt-theme$/,
    typename: 'theme',
    belongsTo: 'theme'
  })
]

/** @type {TYPE} */
export const defaultType = TYPES[0]
