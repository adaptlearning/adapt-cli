/**
 * Execute all promises in parallel, call progressCallback at each promise to allow
 * progress reporting
 * @param {object} param0
 * @param {[Promise]} param0.promises
 * @param {function} param0.progress
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
 * @param {object} param0
 * @param {array} param0.array
 * @param {function} param0.iterator
 * @returns
 */
export async function forEachPromise ({ array, iterator = r => r }) {
  return array.reduce((lastPromise, item) => (lastPromise?.then ? lastPromise : Promise.resolve()).then(() => iterator(item)), Promise.resolve())
}

/**
 * Execute iterator against each item in the array waiting for the iterator returned
 * promise to finish before continuing
 * @param {object} param0
 * @param {Array} param0.array
 * @param {function} param0.iterator
 * @param {function} param0.progress
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
