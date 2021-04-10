import { loadContent } from "./utility"
import * as path from "path"
import * as fs from "fs"

const epub = require("epub-gen")

function newPart(index: number) {
  return {
    title: `Part ${index}`,
    data: loadContent(`fairytale/part${index}.md`)
  }
}

const content = [
  {
    title: "Prelude",
    data: loadContent('fairytale/part0.md')
  }
]
  .concat([1, 2, 3, 4, 5, 6].map(newPart))

const bookConfig = {
  title: "Marloth: A Child's Fairytale World",
  author: "Christopher W. Johnson",
  publisher: "Silent Orb",
  cover: "assets/images/cover.jpg",
  output: "../output/marloth.epub",
  version: 3,
  fonts: ["assets/fonts/carleton.otf"],
  content
}

async function main() {
  if (!fs.existsSync('../output'))
    fs.mkdirSync('../output')

  process.chdir(path.resolve(__dirname, '..'))
  await new epub(bookConfig).promise
  console.log("EPUB successfully generated!")
}

main()
