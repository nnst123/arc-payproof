import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = resolve(projectRoot, 'contracts/out/ArcPayProof.sol/ArcPayProof.json')
const targetPath = resolve(projectRoot, 'web/src/contract/abi.ts')
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'))

mkdirSync(dirname(targetPath), { recursive: true })
writeFileSync(
  targetPath,
  `// Generated from contracts/out/ArcPayProof.sol/ArcPayProof.json. Do not edit by hand.\nexport const arcPayProofAbi = ${JSON.stringify(artifact.abi, null, 2)} as const\n`,
)

console.log(`Wrote ${targetPath}`)
