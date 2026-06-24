import { defineConfig, mergeConfig } from 'vite'
import baseConfigExport from './vite.config'
import { jsxLocPlugin } from '@builder.io/vite-plugin-jsx-loc'

// Without these, Vite bakes `localhost:5173` into the client and CSP blocks the HMR WebSocket under the proxy origin.
const hmrHost = process.env.VIBE_HMR_HOST || undefined
const hmrClientPort = process.env.VIBE_HMR_CLIENT_PORT
  ? Number(process.env.VIBE_HMR_CLIENT_PORT)
  : undefined

export default defineConfig(async (env) => {
  const base = typeof baseConfigExport === 'function'
    ? await baseConfigExport(env)
    : baseConfigExport
  return mergeConfig(base, {
    plugins: [jsxLocPlugin()],
    server: {
      hmr: {
        overlay: false,
        ...(hmrHost ? { host: hmrHost } : {}),
        ...(hmrClientPort ? { clientPort: hmrClientPort } : {}),
      },
    },
  })
})
