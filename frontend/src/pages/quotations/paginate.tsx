import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/**
 * Lays a document out on fixed-size pages, the way a word processor would:
 * every block is measured first, then blocks are placed page by page. A table
 * running onto a new page starts it with its heading again (`carry`, `carryHead`),
 * a heading is never left alone at the foot of a page (`keepWithNext`), and a
 * section can insist on a fresh page (`breakBefore`). Browsers cannot repeat a
 * table head or number pages reliably when printing, so it is done here, and the
 * screen shows exactly the pages that will print.
 *
 * The blocks of one table share a `frame`: on every page the table covers, its
 * blocks are drawn inside one outlined, rounded frame (see `layOut`).
 */

export interface Block {
  key: string
  node: ReactNode
  /** Blocks with the same frame are drawn inside one outlined frame on each page. */
  frame?: string
  /** Placed first on a page this block runs onto, outside the frame: e.g. the page title again. */
  carry?: ReactNode
  /** Placed next, inside the frame: e.g. the table's band and column headings again. */
  carryHead?: ReactNode
  /** Starts on a new page. */
  breakBefore?: boolean
  /** Stays on the same page as the block after it. */
  keepWithNext?: boolean
}

export interface Placed {
  key: string
  node: ReactNode
  frame?: string
}

/** Width of a frame's outline, which framed blocks are measured inside. */
export const FRAME_BORDER = 1

function pack(
  blocks: Block[], height: (key: string) => number, carryHeight: (key: string) => number, headHeight: (key: string) => number, capacity: number,
): Placed[][] {
  const pages: Placed[][] = [[]]
  let used = 0
  const current = () => pages[pages.length - 1]
  const lastFrame = () => current().at(-1)?.frame
  // A block that opens a frame on the page brings the frame's top and bottom outline too.
  const opening = (frame: string | undefined, before: string | undefined) => (frame && frame !== before ? FRAME_BORDER * 2 : 0)
  const place = (p: Placed, h: number) => {
    used += h + opening(p.frame, lastFrame())
    current().push(p)
  }
  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    if (block.breakBefore && current().length) {
      pages.push([])
      used = 0
    }
    // The block with everything that has to go along with it.
    let run = height(block.key) + opening(block.frame, lastFrame())
    for (let j = i; blocks[j].keepWithNext && j + 1 < blocks.length && !blocks[j + 1].breakBefore; j += 1) {
      run += height(blocks[j + 1].key) + opening(blocks[j + 1].frame, blocks[j].frame)
    }
    if (used + run > capacity && current().length) {
      pages.push([])
      used = 0
      if (block.carry) place({ key: `carry:${block.key}`, node: block.carry }, carryHeight(block.key))
      if (block.carryHead) place({ key: `head:${block.key}`, node: block.carryHead, frame: block.frame }, headHeight(block.key))
    }
    place({ key: block.key, node: block.node, frame: block.frame }, height(block.key))
  }
  return pages.filter((page) => page.length)
}

/** Framed blocks are measured at the width inside the frame's outline. */
const cell = (frame?: string): CSSProperties => ({ display: 'flow-root', paddingInline: frame ? FRAME_BORDER : 0 })

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
    const read = (attr: string) => {
      const sizes = new Map<string, number>()
      root.querySelectorAll<HTMLElement>(`[data-${attr}]`).forEach((el) => sizes.set(el.dataset[attr]!, el.getBoundingClientRect().height))
      return (key: string) => sizes.get(key) ?? 0
    }
    setPages(pack(blocks, read('block'), read('carry'), read('head'), capacity))
    if (fontsIn || !document.fonts) setReady(true)
  }, [blocks, capacity, fontsIn])

  // The measuring copy sits in a clipped box of no size: laid out, but adding no
  // scroll height on screen and no blank sheets when printed.
  const measure = (
    <div
      aria-hidden="true" className="print-hidden"
      style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, overflow: 'hidden', visibility: 'hidden', pointerEvents: 'none' }}
    >
      <div ref={box} style={{ width }}>
        {blocks.map((b) => <div key={b.key} data-block={b.key} style={cell(b.frame)}>{b.node}</div>)}
        {blocks.filter((b) => b.carry).map((b) => <div key={b.key} data-carry={b.key} style={cell()}>{b.carry}</div>)}
        {blocks.filter((b) => b.carryHead).map((b) => <div key={b.key} data-head={b.key} style={cell(b.frame)}>{b.carryHead}</div>)}
      </div>
    </div>
  )
  return { measure, pages, ready }
}

/** A page's blocks in order, each run of one frame's blocks wrapped by `frame`. */
export function layOut(placed: Placed[], frame: (children: ReactNode, key: string) => ReactNode): ReactNode[] {
  const out: ReactNode[] = []
  for (let i = 0; i < placed.length;) {
    const group = placed[i].frame
    const run: Placed[] = []
    do run.push(placed[i++])
    while (group && i < placed.length && placed[i].frame === group)
    const cells = run.map((p) => <div key={p.key} style={{ display: 'flow-root' }}>{p.node}</div>)
    out.push(group ? frame(cells, `frame:${run[0].key}`) : cells[0])
  }
  return out
}
