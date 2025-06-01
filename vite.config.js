import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    // Automatically generate self-signed certificates for HTTPS
    basicSsl()
  ],
  
  // Enable HTTPS for WebXR development
  server: {
    https: true,
    host: true, // Allow external connections (for Quest 3)
    port: 5173,
    open: false // Don't auto-open browser since we'll use Quest 3
  },
  
  // Optimize for WebXR development
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three']
        }
      }
    }
  },
  
  // Ensure proper MIME types for WebXR
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
}) 