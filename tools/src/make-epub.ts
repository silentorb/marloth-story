import { adornmentElement, contentElement, EpubChapter, loadContent, renderBook } from "./utility"
import * as path from "path"
import * as fs from "fs"

const epub = require("epub-gen")

function newPart(index: number): EpubChapter {
  return {
    title: `Part ${index}`,
    data: loadContent(`fairytale/part${index}.md`)
  }
}

function fairytaleContent() {
  return renderBook({
    id: "fairytale",
    chapters:[
      {
        title: "Prelude",
        elements: [
          adornmentElement("part0-front"),
          contentElement("part0"),
        ]
      }
    ]
  })
    .concat([1, 2, 3, 4, 5, 6].map(newPart))
}

export function fairytaleBook() {
  return {
    title: "Marloth: A Child's Fairytale World",
    author: "Christopher W. Johnson",
    publisher: "Silent Orb",
    cover: "assets/images/fairytale/cover.jpg",
    output: "../output/marloth.epub",
    version: 3,
    fonts: ["assets/fonts/carleton.otf"],
    content: fairytaleContent(),
  }
}

async function main() {
  if (!fs.existsSync('../output'))
    fs.mkdirSync('../output')

  process.chdir(path.resolve(__dirname, '..'))
  await new epub(fairytaleBook()).promise
  console.log("EPUB successfully generated!")
}

main()
