import * as fs from "fs"

const marked = require("marked")

export function loadContent(filePath: string): string {
  const input = fs.readFileSync('../books/' + filePath, 'utf8')
  return marked(input)
}
