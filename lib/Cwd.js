let cwd = process.cwd()
export default function Cwd (newCWD) {
  if (newCWD) cwd = newCWD
  return cwd
}
