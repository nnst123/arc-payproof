import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifactPath = resolve(projectRoot, 'contracts/out/ArcPayProof.sol/ArcPayProof.json')
const targetPath = resolve(projectRoot, 'web/src/contract/abi.ts')
const deploymentPath = resolve(projectRoot, 'web/src/contract/deployment.ts')
const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'))
const bytecode = artifact.bytecode?.object
if (typeof bytecode !== 'string' || !/^0x(?:[0-9a-fA-F]{2})+$/.test(bytecode)) {
  throw new Error('Arc Foundry artifact has no valid deployment bytecode.')
}

mkdirSync(dirname(targetPath), { recursive: true })
writeFileSync(
  targetPath,
  `// Generated from contracts/out/ArcPayProof.sol/ArcPayProof.json. Do not edit by hand.\nexport const arcPayProofAbi = ${JSON.stringify(artifact.abi, null, 2)} as const\n`,
)

console.log(`Wrote ${targetPath}`)

writeFileSync(
  deploymentPath,
  `// Generated from contracts/out/ArcPayProof.sol/ArcPayProof.json. Do not edit by hand.\nexport const arcPayProofBytecode = '${bytecode}' as const\n`,
)

console.log(`Wrote ${deploymentPath}`)
