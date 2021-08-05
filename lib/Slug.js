import slug from 'speakingurl'
export default function (name) {
  return slug(name, { maintainCase: true })
}
