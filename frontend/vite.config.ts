import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * Writes /sw.js from src/sw.js once a build is done: the list of every file
 * the build produced, for it to cache, and a version that changes whenever any
 * of them does (which is what makes browsers pick up the new build).
 */
function serviceWorker(): Plugin {
  let root = ''
  let outDir = ''
  return {
    name: 'landschaft-service-worker',
    apply: 'build',
    configResolved(config) {
      root = config.root
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).split(sep).join('/'))
        .filter((file) => file !== 'sw.js' && !file.endsWith('.map') && !file.endsWith('.DS_Store'))
        .sort()
      const hash = createHash('sha256')
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)))

      const template = readFileSync(resolve(root, 'src/sw.js'), 'utf8')
      const filled = template
        .replace("const VERSION = 'dev'", `const VERSION = '${hash.digest('hex').slice(0, 12)}'`)
        .replace('const PRECACHE = []', `const PRECACHE = ${JSON.stringify(files.map((file) => `/${file}`))}`)
      if (filled.includes("const VERSION = 'dev'") || filled.includes('const PRECACHE = []')) {
        throw new Error('src/sw.js no longer has the VERSION and PRECACHE lines the build fills in')
      }
      writeFileSync(join(outDir, 'sw.js'), filled)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
})
