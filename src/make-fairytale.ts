import { Chapter, contentElement, loadTextFile, renderBook } from './utility'

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
    chapters: [
      {
        title: `Cover`,
        excludeFromToc: true,
        elements: [
          contentElement('cover'),
        ]
      },
      {
        title: `door1`,
        excludeFromToc: true,
        elements: [
          contentElement('door1'),
        ]
      },
      {
        title: `Marloth: A Child's Fairytale World`,
        elements: [
          contentElement('front'),
        ]
      },
      {
        title: `Contents`,
        elements: [
          contentElement('contents'),
        ]
      },
      {
        title: 'Prelude',
        elements: [
          contentElement('part0'),
        ]
      }
    ]
      .concat([1, 2, 3, 4, 5, 6].map(newPart)).concat([
        {
          title: `back`,
          excludeFromToc: true,
          elements: [
            contentElement('back'),
          ]
        },
      ])
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
    fonts: [
      'src/assets/fonts/carleton.otf',
      'src/assets/fonts/EBGaramond-Italic.ttf',
      'src/assets/fonts/EBGaramond-Regular.ttf',
      'src/assets/fonts/EBGaramond-SemiBold.ttf',
      'src/assets/fonts/EBGaramond-SemiBoldItalic.ttf',
    ],
    content: fairytaleContent(),
    css: loadTextFile('src/assets/styles/style.css'),
    verbose: true,
    appendChapterTitles: false,
    metadata: [
      ['dc:subject', 'Fantasy fiction'],
      ['dc:subject', 'Gothic fiction'],
      ['dc:subject', 'Horror tales'],
    ],
    guide: [
      {
        type: 'toc',
        title: 'Contents',
        href: '3_contents.xhtml'
      },
      {
        type: 'cover',
        title: 'Cover',
        href: '0_cover.xhtml'
      },
    ],
  }
}

async function main() {
  fse.ensureDirSync('output/fairytale')
  await new epub(fairytaleBook()).generate()
  console.log('EPUB successfully generated!')
}

main()
