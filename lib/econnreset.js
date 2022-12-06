// guard against ECONNRESET issues https://github.com/adaptlearning/adapt-cli/issues/169
process.on('uncaughtException', (error, origin) => {
  if (error?.code === 'ECONNRESET') return
  console.error('UNCAUGHT EXCEPTION')
  console.error(error)
  console.error(origin)
})
