import { copyFile, lstat, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dir, '..')
const output = Bun.argv[2] ? resolve(Bun.argv[2]) : null
if (!output || output === root || !relative(root, output).startsWith('..')) {
  throw new Error('Usage: bun scripts/export-evm.mjs /absolute/path/to/new-standalone-directory')
}
await mkdir(output)

async function git(...args) {
  const child = Bun.spawn(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const result = await new Response(child.stdout).text()
  if (await child.exited !== 0) throw new Error(await new Response(child.stderr).text())
  return result.trim()
}
const sourceFiles = (await git('ls-files', '--cached', '--others', '--exclude-standard')).split('\n')
async function copy(source, destination) {
  if (!(await lstat(join(root, source))).isFile()) throw new Error(`Only regular source files can be exported: ${source}`)
  const target = join(output, destination)
  await mkdir(dirname(target), { recursive: true })
  await copyFile(join(root, source), target)
}
for (const source of sourceFiles) {
  if (source.startsWith('packages/evm/')) await copy(source, source.slice('packages/evm/'.length))
  else if (source.startsWith('tools/oxlint/anti-slop/')) await copy(source, source)
  else if (/^packages\/sugar\/(src\/|scripts\/|package\.json$|tsconfig\.json$|README\.md$|LICENSE[^/]*$|NOTICE$)/.test(source)) await copy(source, source)
}
const write = (path, content) => writeFile(join(output, path), content)
const json = (path, value) => write(path, `${JSON.stringify(value, null, 2)}\n`)
const manifest = JSON.parse(await readFile(join(output, 'package.json'), 'utf8'))
const tooling = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).devDependencies
manifest.workspaces = ['packages/sugar']
manifest.overrides = { '@effect/platform-node-shared': '4.0.0-beta.107' }
manifest.packageManager = `bun@${Bun.version}`
manifest.license = 'SEE LICENSE IN LICENSE'
manifest.repository = { type: 'git', url: 'https://github.com/OxFrancesco/evmSDK.git' }
manifest.devDependencies = { ...manifest.devDependencies, oxlint: tooling.oxlint, '@oxlint/plugins': tooling['@oxlint/plugins'] }
manifest.scripts['test:aero'] = 'bun run --cwd packages/sugar test'
await json('package.json', manifest)
const baseLint = JSON.parse(await readFile(join(root, '.oxlintrc.json'), 'utf8'))
await json('.oxlintrc.base.json', baseLint)
await json('.oxlintrc.json', {
  extends: ['./.oxlintrc.base.json'],
  jsPlugins: [
    { name: 'anti-slop', specifier: './tools/oxlint/anti-slop/index.ts' },
    { name: 'anti-slop-effect', specifier: './tools/oxlint/anti-slop/effect/index.ts' },
  ],
  rules: { 'anti-slop-effect/no-service-constructor-imports': 'error' },
})
const sugar = JSON.parse(await readFile(join(output, 'packages/sugar/package.json'), 'utf8'))
sugar.scripts.lint = sugar.scripts.lint.replace('../../.oxlintrc.json', '../../.oxlintrc.base.json')
await json('packages/sugar/package.json', sugar)
await mkdir(join(output, 'docs'), { recursive: true })
for (const name of ['23-general-evm-sdk.md', '24-evm-smart-wallets.md']) {
  const text = await readFile(join(root, 'docs', name), 'utf8')
  await write(`docs/${name}`, text.replaceAll('bun run --cwd packages/evm ', 'bun run ').replaceAll('../packages/evm/README.md', '../README.md'))
}
const readme = await readFile(join(output, 'README.md'), 'utf8')
await write('README.md', readme.replace('# EVM SDK, CLI, TUI and MCP', '# evmSDK')
  .replaceAll('bun run --cwd packages/evm ', 'bun run ')
  .replaceAll('bun packages/evm/dist/', 'bun dist/')
  .replaceAll('../../docs/', './docs/')
  + '\n## Standalone repository\n\nThis repository contains the toolkit at its root and its Aero dependency in `packages/sugar`. It installs without a BeeGreat checkout. Smart-wallet login uses the hosted BeeGreat web app; this repository does not duplicate BeeGreat authentication or contain its secrets. See [standalone maintenance](docs/standalone.md).\n')
await write('docs/standalone.md', '# Standalone maintenance\n\nBeeGreat is the source repository. This export includes the toolkit, the Aero source dependency, lint rules, tests and required license notices. The architecture documents retain monorepo paths when describing the hosted BeeGreat web integration.\n\nCreate a new snapshot from BeeGreat with `bun scripts/export-evm.mjs /absolute/path/to/new-directory`. The exporter refuses an existing destination and exports only Git-visible source files. Review the resulting diff before updating this repository; never overwrite standalone changes blindly. `SOURCE.json` records the source revision and whether uncommitted changes were included.\n\nRun `bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, and `bun run test:e2e`. Foundry is required for end-to-end tests. `bun run test:aero` validates the bundled protocol dependency. Keep the root lockfile with each update.\n\nThe repository is public. Its visibility does not change third-party licensing terms. Read the retained Aero licensing review and NOTICE before redistributing or deploying licensed protocol-derived material.\n')
await copy('packages/sugar/LICENSE', 'LICENSE')
await copy('packages/sugar/LICENSE.Apache-2.0', 'LICENSE.Apache-2.0')
await copy('packages/sugar/LICENSE.Mellow-BUSL-1.1', 'LICENSE.Mellow-BUSL-1.1')
await write('NOTICE', 'Original EVM toolkit code is by Francesco Oddo. The MIT terms in LICENSE apply to original contributions only.\n\nThe Aero dependency in packages/sugar retains its own LICENSE, NOTICE and third-party terms, including Apache-2.0 and Mellow BUSL-1.1. Read packages/sugar/NOTICE and its dated README licensing review. Upstream reference repositories are not included. Runtime dependencies retain their respective licenses.\n\nThis is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol.\n')
await write('.gitignore', 'node_modules/\ndist/\n.env\n.env.*\n!.env.example\n.dev.vars\n.DS_Store\nartifacts/\nfixtures/out/\nfixtures/cache/\n*.sqlite\n*.sqlite-*\n.wrangler/\n.vercel/\n')
await json('SOURCE.json', { repository: 'https://github.com/OxFrancesco/BeeGreat', revision: await git('rev-parse', 'HEAD'), dirty: Boolean(await git('status', '--porcelain')), package: 'packages/evm' })
await mkdir(join(output, '.github/workflows'), { recursive: true })
await write('.github/workflows/check.yml', `name: Check
on:
  push:
  pull_request:
permissions:
  contents: read
jobs:
  check:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${Bun.version}
      - uses: foundry-rs/foundry-toolchain@v1
        with:
          version: stable
      - run: bun install --frozen-lockfile
      - run: bun run typecheck
      - run: bun run lint
      - run: bun run test
      - run: bun run --cwd packages/sugar typecheck
      - run: bun run --cwd packages/sugar lint
      - run: bun run test:aero
      - run: bun run build
      - run: bun run test:e2e
`)
console.log(`Exported standalone toolkit to ${output}`)
