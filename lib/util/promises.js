/**
 * Execute all promises in parallel, call progressCallback at each promise to allow
 * progress reporting
 * @param {object} options
 * @param {[Promise]} options.promises
 * @param {function} options.progress
 * @returns
 */
export async function promiseAllProgress ({ promises, progress }) {
  let currentIndex = 0
  progress(0)
  const passThroughPromises = []
  for (const promise of promises) {
    passThroughPromises.push((promise?.then ? promise : Promise.resolve()).then(value => {
      currentIndex++
      progress(parseInt((currentIndex * 100) / promises.length))
      return value
    }))
  }
  return Promise.all(passThroughPromises)
}

/**
 * Execute iterator against each item in the array waiting for the iterator returned
 * promise to finish before continuing
 * @param {object} options
 * @param {array} options.array
 * @param {function} options.iterator
 * @returns
 */
export async function forEachPromise ({ array, iterator = r => r }) {
  return array.reduce((lastPromise, item) => (lastPromise?.then ? lastPromise : Promise.resolve()).then(() => iterator(item)), Promise.resolve())
}

/**
 * Execute iterator against each item in the array waiting for the iterator returned
 * promise to finish before continuing
 * @param {object} options
 * @param {Array} options.array
 * @param {function} options.iterator
 * @param {function} options.progress
 * @returns
 */
export async function forEachPromiseProgress ({ array, iterator = r => r, progress }) {
  let currentIndex = 0
  progress(0)
  return forEachPromise({
    array,
    iterator: item => {
      currentIndex++
      progress(parseInt((currentIndex * 100) / array.length))
      return iterator(item)
    }
  })
}
