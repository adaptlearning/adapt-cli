export default function importMetaToDirName (importMeta) {
  const __dirname = (process.platform === 'win32')
    ? new URL('.', importMeta.url).pathname.slice(1)
    : new URL('.', import.meta.url).pathname
  return __dirname
}
