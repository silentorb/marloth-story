import * as fs from "fs"
import { transformContent } from './formatting'

const marked = require("marked")

export function loadContent(filePath: string): string {
  const input = fs.readFileSync('../books/' + filePath, 'utf8')
  const transformed = transformContent(input)
  return marked(transformed)
}
