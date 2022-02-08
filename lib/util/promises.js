import { eachOfLimit, eachOfSeries } from 'async'
/**
 * Execute all promises in parallel, call progress at each promise to allow
 * progress reporting
 * @param {Array} array
 * @param {function} iterator
 * @param {function} progress
 * @returns
 */
export async function eachOfLimitProgress (array, iterator, progress) {
  let currentIndex = 0
  progress(0)
  await eachOfLimit(array, 8, async item => {
    currentIndex++
    progress(parseInt((currentIndex * 100) / array.length))
    return iterator(item)
  })
}

/**
 * Execute iterator against each item in the array waiting for the iterator returned
 * to finish before continuing, calling progress as each stage
 * @param {Array} array
 * @param {function} iterator
 * @param {function} progress
 * @returns
 */
export async function eachOfSeriesProgress (array, iterator, progress) {
  let currentIndex = 0
  progress(0)
  await eachOfSeries(array, async item => {
    currentIndex++
    progress(parseInt((currentIndex * 100) / array.length))
    return iterator(item)
  })
}
