export default {
  log: function () {
    console.log.apply(this, arguments)
  },
  error: function () {
    console.error.apply(this, arguments)
  }
}
