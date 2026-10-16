// The repo lives in a folder iCloud syncs, which makes conflict copies named
// "something 2.ts". Committing them once put duplicate database migrations into
// main. This fails (locally and in CI) if any such file exists, so it is noticed
// before it can be committed.
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SKIP = new Set(['node_modules', '.next', '.git', '.vercel', 'coverage', '.code-review-graph'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP.has(name)) return []
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [relative(ROOT, full)]
  })
}

describe('repo hygiene', () => {
  it('has no iCloud conflict copies such as "page 2.tsx"', () => {
    const copies = walk(ROOT).filter((f) => / \d+(\.[^/]*)?$/.test(f.split('/').pop() ?? ''))
    expect(copies, 'delete these conflict copies (compare with the original first)').toEqual([])
  })
})
