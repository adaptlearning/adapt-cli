/**
 * Execute all promises serialized, call progressCallback at each promise to allow
 * progress reporting
 * @param {*} promises
 * @param {*} progressCallback
 * @returns
 */
export async function promiseAllProgress (promises, progressCallback) {
  const passThroughPromises = []
  let currentIndex = 0
  progressCallback(0)
  for (const promise of promises) {
    passThroughPromises.push((promise?.then ? promise : Promise.resolve()).then(value => {
      currentIndex++
      progressCallback(parseInt((currentIndex * 100) / promises.length))
      return value
    }))
  }
  return Promise.all(passThroughPromises)
}

/**
 * Execute iterator against each item in the array waiting for the iterator returned
 * promise to finish before continuing
 * @param {Array} arr
 * @param {function} iterator
 * @returns
 */
export async function forEachPromise (arr, iterator = r => r) {
  return arr.reduce((lastPromise, item) => (lastPromise?.then ? lastPromise : Promise.resolve()).then(() => iterator(item)), Promise.resolve())
}
