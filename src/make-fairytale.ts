import { adornmentElement, Chapter, contentElement, renderBook } from './utility'
import * as path from 'path'

const fse = require('fs-extra')
const epub = require('epub-gen')

function newPart(index: number): Chapter {
  return {
    title: `Part ${index}`,
    elements: [contentElement(`part${index}`)]
  }
}

function fairytaleContent() {
  return renderBook({
    id: 'fairytale',
    chapters:[
      {
        title: 'Frontmatter',
        elements: [
          contentElement('frontmatter'),
        ]
      },
      {
        title: 'Prelude',
        elements: [
          adornmentElement('part0-front'),
          contentElement('part0'),
        ]
      }
    ]
      .concat([1, 2, 3, 4, 5, 6].map(newPart))
  })
}

export function fairytaleBook() {
  return {
    title: `Marloth: A Child's Fairytale World`,
    author: 'Christopher W. Johnson',
    publisher: 'Silent Orb',
    cover: 'src/assets/images/fairytale/cover.jpg',
    output: 'output/fairytale/marloth.epub',
    version: 3,
    fonts: ['src/assets/fonts/carleton.otf'],
    content: fairytaleContent(),
  }
}

async function main() {
  fse.ensureDirSync('output/fairytale')
  await new epub(fairytaleBook()).promise
  console.log('EPUB successfully generated!')
}

main()
