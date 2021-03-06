import path from 'path'

import unified from 'unified'
import vFile from 'vfile'
import yaml from 'js-yaml'

import fetch from 'node-fetch'

import { Catalog } from '../../ports/build-book'
import mdastToReviewPlugin from '../../easybooks-ast/review-stringify'
import { parseMarkdown, createImporter } from '../../easybooks-ast/markdown'
import { ProjectFilesPort } from '../../ports/project-files'

const review = unified().use(mdastToReviewPlugin)
const { importSource } = createImporter({
  importer: {
    fetchText: async url => {
      const res = await fetch(url)
      return res.text()
    },
  },
})

export const convert = async (
  files: ProjectFilesPort,
  src: string,
  dest: string,
) => {
  const markdownText = await files.readFileFromProject(src)
  const root = await parseMarkdown(markdownText)
  await importSource(root)
  await files.writeFileToDisk(
    dest,
    review.stringify(
      root,
      vFile({ data: path.basename(dest).replace(/\.[a-zA-Z0-9]+$/, '') }),
    ),
  )
}

export const writeYaml = async (
  files: ProjectFilesPort,
  filename: string,
  data: any,
) => {
  await files.writeFileToDisk(filename, yaml.dump(data))
}

export const createCatalog = (
  files: ProjectFilesPort,
  catalog: Catalog,
) => {
  const tasks: Promise<any>[] = []
  Object.keys(catalog).map(key => {
    catalog[key] = catalog[key].map(filename => {
      if (filename.endsWith('.md')) {
        const reviewFilename = filename.replace(/\.md$/, '.re')
        tasks.push(convert(files, filename, reviewFilename))
        return reviewFilename
      } else {
        const copy = async () => {
          await files.exportFileToDisk(filename)
        }
        tasks.push(copy())
        return filename
      }
    })
  })

  return { catalog, tasks }
}

export const copyTemplates = async (
  files: ProjectFilesPort,
  templates: string[],
) => {
  if (templates.length === 0) {
    return
  }
  await Promise.all(
    templates.map(dir => files.exportFilesToDiskRecursive(dir)),
  )
}
