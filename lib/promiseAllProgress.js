export default function promiseAllProgress (promises, progressCallback) {
  const passThroughPromises = []
  let currentIndex = 0
  progressCallback(0)
  for (const promise of promises) {
    passThroughPromises.push(promise.then(value => {
      currentIndex++
      progressCallback((currentIndex * 100) / promises.length)
      return value
    }))
  }
  return Promise.all(passThroughPromises)
}
