import * as fs from 'fs'
import { postTransformContent, preTransformContent, } from './formatting'

const marked = require('marked')

export function loadTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

export function loadAdornment(filePath: string): string {
  return loadTextFile('src/assets/adornments/' + filePath)
}

export function loadContent(filePath: string, config: any): string {
  const input = loadTextFile('books/' + filePath)
  const transformed = preTransformContent(input)
  return postTransformContent(marked(transformed), config.version)
}

export enum ElementType {
  adornment,
  content
}

export interface ContentElement {
  type: ElementType,
  name: string
}

const newContentElement = (type: ElementType) => (name: string) => ({
  type,
  name,
})

export const adornmentElement = newContentElement(ElementType.adornment)
export const contentElement = newContentElement(ElementType.content)

export interface Chapter {
  title: string
  elements: ContentElement[]
}

export type Loader = (book: string, name: string, config: any) => string

const elementLoaders: { [key: string]: Loader } = {
  [ElementType.adornment]: (book, name) => loadAdornment(`${book}/${name}.html`),
  [ElementType.content]: (book, name, config) => loadContent(`${book}/${name}.md`, config),
}

export const renderContentElement = (book: string, config: any) => (element: ContentElement) => {
  return elementLoaders[element.type](book, element.name, config)
}

export interface EpubChapter {
  title: string
  data: string
}

export const renderChapter = (book: string, config: any) => (chapter: Chapter): EpubChapter => {
  const data = chapter.elements.map(renderContentElement(book, config)).join('\n')
  const result = {
    ...chapter,
    data,
  } as any

  delete result.elements
  return result
}

export interface BookInput {
  id: string
  chapters: Chapter[]
  config: any
}

export function renderBook(input: BookInput): EpubChapter[] {
  return input.chapters.map(renderChapter(input.id, input.config))
}
