import { loadTextFile } from "./utility"
import { parseMatterSource } from "./matter"

const fse = require('fs-extra')

async function main() {
  fse.ensureDirSync('../dist/twold')
  const content = loadTextFile('books/twold/part1.md')
  const tokens = parseMatterSource(content)
  // console.log('EPUB successfully generated!')
}

main()
