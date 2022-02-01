import Project from '../Project.js'

export default async function schemas ({ cwd = process.cwd() } = {}) {
  const project = new Project({ cwd })
  return await project.getSchemaPaths({ cwd })
}
