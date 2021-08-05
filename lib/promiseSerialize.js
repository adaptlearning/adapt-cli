export default function promiseSerialize (arr, iterator) {
  // create a empty promise to start our series (so we can use `then`)
  const currentPromise = Promise.resolve()
  arr.reduce((lastPromise, nextPromise) => lastPromise.then(nextPromise), currentPromise)
  return currentPromise
}
