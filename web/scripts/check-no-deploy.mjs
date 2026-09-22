import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = resolve(import.meta.dirname, '..')
const distRoot = resolve(webRoot, 'dist')
const source = readFileSync(resolve(webRoot, 'src/contract/deployment.ts'), 'utf8')
const bytecode = source.match(/arcPayProofBytecode = '(0x[0-9a-fA-F]+)'/)?.[1]
if (!bytecode || bytecode.length < 100) throw new Error('Generated deployment bytecode is missing.')

function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) {
      checkDirectory(path)
      continue
    }
    if (entry.name === 'deploy.html') throw new Error('Local deployment page leaked into the production build.')
    if (entry.name.endsWith('.js') && readFileSync(path, 'utf8').includes(bytecode.slice(0, 100))) {
      throw new Error(`Deployment bytecode leaked into ${path}.`)
    }
  }
}

checkDirectory(distRoot)
console.log('Production build excludes the local deployment page and bytecode.')
