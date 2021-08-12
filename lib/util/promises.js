export function promiseAllProgress (promises, progressCallback) {
  const passThroughPromises = []
  let currentIndex = 0
  progressCallback(0)
  for (const promise of promises) {
    passThroughPromises.push(promise.then(value => {
      currentIndex++
      progressCallback(parseInt((currentIndex * 100) / promises.length))
      return value
    }))
  }
  return Promise.all(passThroughPromises)
}

export function promiseAllSerialize (arr, iterator = r => r) {
  return arr.reduce((lastPromise, nextPromise) => lastPromise.then(nextPromise).then(iterator), Promise.resolve())
}
