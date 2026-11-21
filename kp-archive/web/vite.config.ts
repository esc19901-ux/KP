import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' makes the build work on GitHub Pages project sites (user.github.io/repo/) and Vercel alike.
export default defineConfig({ base: './', plugins: [react(), tailwindcss()] })
