import * as fs from 'fs'
import { postTransformContent, preTransformContent, } from './formatting'

const marked = require('marked')

export function loadTextFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

export function loadAdornment(filePath: string): string {
  return loadTextFile('src/assets/adornments/' + filePath)
}

export function loadContent(filePath: string): string {
  const input = loadTextFile('books/' + filePath)
  const transformed = preTransformContent(input)
  return postTransformContent(marked(transformed))
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

export type Loader = (book: string, name: string) => string

const elementLoaders: { [key: string]: Loader } = {
  [ElementType.adornment]: (book, name) => loadAdornment(`${book}/${name}.html`),
  [ElementType.content]: (book, name) => loadContent(`${book}/${name}.md`),
}

export const renderContentElement = (book: string) => (element: ContentElement) => {
  return elementLoaders[element.type](book, element.name)
}

export interface EpubChapter {
  title: string
  data: string
}

export const renderChapter = (book: string) => (chapter: Chapter): EpubChapter => {
  const data = chapter.elements.map(renderContentElement(book)).join('\n')
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
}

export function renderBook(input: BookInput): EpubChapter[] {
  return input.chapters.map(renderChapter(input.id))
}
