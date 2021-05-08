const marked = require('marked')

export function parseMatterSource(content: string) {
  const tokens = marked.lexer(content)
  return tokens
}
