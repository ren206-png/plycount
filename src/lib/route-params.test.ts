// Next 16 hands pages `params` as a Promise. A client page that reads
// `params.id` directly gets undefined, so detail pages showed "not found" for
// records that exist. Client pages must use useParams() instead.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return pages(full)
    return name === 'page.tsx' ? [full] : []
  })
}

describe('client pages read route params with useParams()', () => {
  const clientPages = pages(join(process.cwd(), 'src/app')).filter((f) =>
    readFileSync(f, 'utf8').trimStart().startsWith("'use client'")
  )

  it('finds the client pages', () => {
    expect(clientPages.length).toBeGreaterThan(8)
  })

  it.each(clientPages)('%s does not take params as a prop', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/\{\s*params\s*\}\s*:/)
  })
})
