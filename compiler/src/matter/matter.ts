import * as marked from 'marked'
import { Token } from "marked"
import { Section } from "./types"

function getChildrenEnd(tokens: Token[], start: number, depth: number): number {
  const end = tokens.slice(start).findIndex(t => 'depth' in t && t.depth <= depth)
  return end == -1
    ? tokens.length
    : start + end
}

function getChildren(tokens: Token[], start: number, depth: number): Token[] {
  const end = getChildrenEnd(tokens, start, depth)
  return tokens.slice(start, end)
}

function getHeaderList(headerTitle: string, tokens: Token[]): Token[] {
  const headingIndex = tokens.findIndex(t => t.type == 'heading' && t.text == headerTitle)
  if (headingIndex == -1)
    return []

  const heading = tokens[headingIndex] as marked.Tokens.Heading
  return getChildren(tokens, headingIndex + 1, heading.depth)
}

function gatherSectionsList(tokens: Token[]): Section[] {
  const result: Section[] = []
  let index = 0
  while (index < tokens.length) {
    const heading = tokens[index]
    if (!('depth' in heading))
      break

    const children = getChildren(tokens, index + 1, heading.depth)
    result.push({
      name: heading.text,
      tokens: children,
    })
    index += 1 + children.length
  }
  return result
}

function gatherSectionsMap(tokens: Token[]): { [key: string]: Section } {
  const sections = gatherSectionsList(tokens)
  return Object.fromEntries(sections.map(s => ([s.name, s])))
}

export function parseMatterSource(content: string) {
  const tokens = marked.lexer(content)
  const sectionsTokens = getHeaderList('Sections', tokens)
  const sections = gatherSectionsList(sectionsTokens)
    .map(s => ({
      name: s.name,
      sections: gatherSectionsMap(s.tokens),
    }))
  return tokens
}
