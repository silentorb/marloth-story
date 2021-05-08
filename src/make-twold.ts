import * as path from 'path'
const fse = require('fs-extra')

async function main() {
  fse.ensureDirSync('output/twold')
  process.chdir(path.resolve(__dirname, '..'))
  // await new epub(fairytaleBook()).promise
  console.log('EPUB successfully generated!')
}

main()
