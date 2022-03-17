import Project from '../Project.js'
import path from 'path'

export default async function schemas ({ cwd = process.cwd() } = {}) {
  cwd = path.resolve(process.cwd(), cwd)
  const project = new Project({ cwd })
  return await project.getSchemaPaths({ cwd })
}
