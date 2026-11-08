import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Lays a document out on fixed-size pages, the way a word processor would:
 * every block is measured first, then blocks are placed page by page. A table
 * running onto a new page starts it with its heading again (`carry`), a heading
 * is never left alone at the foot of a page (`keepWithNext`), and a section can
 * insist on a fresh page (`breakBefore`). Browsers cannot repeat a table head
 * or number pages reliably when printing, so it is done here, and the screen
 * shows exactly the pages that will print.
 */

export interface Block {
  key: string
  node: ReactNode
  /** Placed first on a page this block runs onto, e.g. the table's band and column headings again. */
  carry?: ReactNode
  /** Starts on a new page. */
  breakBefore?: boolean
  /** Stays on the same page as the block after it. */
  keepWithNext?: boolean
}

export interface Placed {
  key: string
  node: ReactNode
}

function pack(blocks: Block[], height: (key: string) => number, carryHeight: (key: string) => number, capacity: number): Placed[][] {
  const pages: Placed[][] = [[]]
  let used = 0
  const current = () => pages[pages.length - 1]
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.breakBefore && current().length) {
      pages.push([])
      used = 0
    }
    // The block with everything that has to go along with it.
    let run = height(block.key)
    for (let j = i; blocks[j].keepWithNext && j + 1 < blocks.length && !blocks[j + 1].breakBefore; j += 1) {
      run += height(blocks[j + 1].key)
    }
    if (used + run > capacity && current().length) {
      pages.push([])
      used = 0
      if (block.carry) {
        current().push({ key: `carry:${block.key}`, node: block.carry })
        used += carryHeight(block.key)
      }
    }
    current().push({ key: block.key, node: block.node })
    used += height(block.key)
  }
  return pages.filter((page) => page.length)
}

/**
 * Measures `blocks` at the page's content width and hands back the pages.
 * `ready` turns true once fonts have loaded and everything is measured.
 */
export function usePages(blocks: Block[], width: number, capacity: number): { measure: ReactNode; pages: Placed[][]; ready: boolean } {
  const box = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<Placed[][]>([])
  const [ready, setReady] = useState(false)
  const [fontsIn, setFontsIn] = useState(false)

  useLayoutEffect(() => {
    let live = true
    void document.fonts?.ready.then(() => live && setFontsIn(true))
    return () => {
      live = false
    }
  }, [])

  useLayoutEffect(() => {
    const root = box.current
    if (!root) return
    const heights = new Map<string, number>()
    const carries = new Map<string, number>()
    root.querySelectorAll<HTMLElement>('[data-block]').forEach((el) => heights.set(el.dataset.block!, el.getBoundingClientRect().height))
    root.querySelectorAll<HTMLElement>('[data-carry]').forEach((el) => carries.set(el.dataset.carry!, el.getBoundingClientRect().height))
    setPages(pack(blocks, (k) => heights.get(k) ?? 0, (k) => carries.get(k) ?? 0, capacity))
    if (fontsIn || !document.fonts) setReady(true)
  }, [blocks, capacity, fontsIn])

  const measure = (
    <div ref={box} aria-hidden="true" style={{ position: 'absolute', left: -20000, top: 0, width, visibility: 'hidden', pointerEvents: 'none' }}>
      {blocks.map((b) => <div key={b.key} data-block={b.key} style={{ display: 'flow-root' }}>{b.node}</div>)}
      {blocks.filter((b) => b.carry).map((b) => <div key={b.key} data-carry={b.key} style={{ display: 'flow-root' }}>{b.carry}</div>)}
    </div>
  )
  return { measure, pages, ready }
}
