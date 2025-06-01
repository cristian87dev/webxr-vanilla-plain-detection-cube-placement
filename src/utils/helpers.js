/**
 * Helper Functions for WebXR Development
 * Utility functions for debugging, logging, and general WebXR tasks
 */

/**
 * Log WebXR-specific information with emojis for better readability
 */
export const logger = {
  info: (message, data = null) => {
    console.log(`ℹ️  [WebXR] ${message}`, data || '')
  },
  success: (message, data = null) => {
    console.log(`✅ [WebXR] ${message}`, data || '')
  },
  warn: (message, data = null) => {
    console.warn(`⚠️  [WebXR] ${message}`, data || '')
  },
  error: (message, error = null) => {
    console.error(`❌ [WebXR] ${message}`, error || '')
  },
  debug: (message, data = null) => {
    console.debug(`🔍 [WebXR] ${message}`, data || '')
  },
  plane: (message, planeData = null) => {
    console.log(`🎯 [Planes] ${message}`, planeData || '')
  }
}

/**
 * Check if the current environment supports WebXR
 * @returns {Object} Support information
 */
export async function checkWebXRSupport() {
  const support = {
    webxr: false,
    immersiveAR: false,
    planeDetection: false,
    hitTest: false,
    browser: getBrowserInfo(),
    device: getDeviceInfo()
  }

  try {
    // Check basic WebXR support
    if (navigator.xr) {
      support.webxr = true
      
      // Check immersive AR support
      support.immersiveAR = await navigator.xr.isSessionSupported('immersive-ar')
      
      if (support.immersiveAR) {
        // Test plane detection
        try {
          const testSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['plane-detection']
          })
          support.planeDetection = true
          await testSession.end()
        } catch (e) {
          support.planeDetection = false
        }

        // Test hit testing
        try {
          const testSession = await navigator.xr.requestSession('immersive-ar', {
            requiredFeatures: ['hit-test']
          })
          support.hitTest = true
          await testSession.end()
        } catch (e) {
          support.hitTest = false
        }
      }
    }
  } catch (error) {
    logger.error('Error checking WebXR support', error)
  }

  return support
}

/**
 * Get browser information
 * @returns {Object} Browser details
 */
export function getBrowserInfo() {
  const userAgent = navigator.userAgent
  let browser = 'unknown'
  let version = 'unknown'

  if (userAgent.includes('OculusBrowser')) {
    browser = 'Meta Browser'
    const match = userAgent.match(/OculusBrowser\/([\d.]+)/)
    version = match ? match[1] : 'unknown'
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome'
    const match = userAgent.match(/Chrome\/([\d.]+)/)
    version = match ? match[1] : 'unknown'
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox'
    const match = userAgent.match(/Firefox\/([\d.]+)/)
    version = match ? match[1] : 'unknown'
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari'
    const match = userAgent.match(/Safari\/([\d.]+)/)
    version = match ? match[1] : 'unknown'
  }

  return { name: browser, version, userAgent }
}

/**
 * Get device information
 * @returns {Object} Device details
 */
export function getDeviceInfo() {
  const userAgent = navigator.userAgent
  let device = 'unknown'
  let platform = navigator.platform || 'unknown'

  if (userAgent.includes('Quest')) {
    device = 'Meta Quest'
    if (userAgent.includes('Quest 3')) device = 'Meta Quest 3'
    else if (userAgent.includes('Quest 2')) device = 'Meta Quest 2'
    else if (userAgent.includes('Quest Pro')) device = 'Meta Quest Pro'
  } else if (userAgent.includes('Android')) {
    device = 'Android Device'
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    device = 'iOS Device'
  }

  return {
    name: device,
    platform,
    userAgent,
    isQuest: device.includes('Meta Quest'),
    isQuest3: device === 'Meta Quest 3'
  }
}

/**
 * Format bytes to human readable format
 * @param {number} bytes Number of bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Format duration in milliseconds to human readable format
 * @param {number} ms Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Create a performance monitor for WebXR
 */
export class PerformanceMonitor {
  constructor() {
    this.stats = {
      frameCount: 0,
      startTime: performance.now(),
      lastFrameTime: 0,
      frameRate: 0,
      averageFrameTime: 0,
      frameTimes: []
    }
  }

  /**
   * Update performance stats
   * @param {number} timestamp Current timestamp
   */
  update(timestamp) {
    this.stats.frameCount++
    
    if (this.stats.lastFrameTime > 0) {
      const deltaTime = timestamp - this.stats.lastFrameTime
      this.stats.frameTimes.push(deltaTime)
      
      // Keep only last 60 frame times
      if (this.stats.frameTimes.length > 60) {
        this.stats.frameTimes.shift()
      }
      
      // Calculate average frame time and FPS
      const totalTime = this.stats.frameTimes.reduce((a, b) => a + b, 0)
      this.stats.averageFrameTime = totalTime / this.stats.frameTimes.length
      this.stats.frameRate = 1000 / this.stats.averageFrameTime
    }
    
    this.stats.lastFrameTime = timestamp
  }

  /**
   * Get current performance stats
   * @returns {Object} Performance statistics
   */
  getStats() {
    const runtime = performance.now() - this.stats.startTime
    return {
      ...this.stats,
      runtime: formatDuration(runtime),
      fps: Math.round(this.stats.frameRate * 10) / 10
    }
  }

  /**
   * Log performance stats to console
   */
  logStats() {
    const stats = this.getStats()
    logger.debug(`Performance: ${stats.fps} FPS, ${stats.frameCount} frames, ${stats.runtime}`)
  }
}

/**
 * Debounce function to limit function calls
 * @param {Function} func Function to debounce
 * @param {number} wait Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function to limit function calls
 * @param {Function} func Function to throttle
 * @param {number} limit Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Create a simple state manager for WebXR application state
 */
export class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState }
    this.listeners = new Map()
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return { ...this.state }
  }

  /**
   * Update state
   * @param {Object} updates State updates
   */
  setState(updates) {
    const oldState = { ...this.state }
    this.state = { ...this.state, ...updates }
    
    // Notify listeners
    for (const [key, callback] of this.listeners) {
      if (updates.hasOwnProperty(key)) {
        callback(this.state[key], oldState[key])
      }
    }
  }

  /**
   * Subscribe to state changes
   * @param {string} key State key to watch
   * @param {Function} callback Callback function
   */
  subscribe(key, callback) {
    this.listeners.set(key, callback)
  }

  /**
   * Unsubscribe from state changes
   * @param {string} key State key to unwatch
   */
  unsubscribe(key) {
    this.listeners.delete(key)
  }
}

/**
 * Create a simple error boundary for WebXR errors
 * @param {Function} fn Function to wrap
 * @param {string} context Context description for errors
 * @returns {Function} Wrapped function
 */
export function createErrorBoundary(fn, context) {
  return async function(...args) {
    try {
      return await fn.apply(this, args)
    } catch (error) {
      logger.error(`Error in ${context}`, error)
      
      // You might want to send this to analytics or crash reporting
      if (window.gtag) {
        window.gtag('event', 'exception', {
          description: `WebXR Error: ${context}`,
          fatal: false
        })
      }
      
      throw error
    }
  }
}

/**
 * Wait for a specified amount of time
 * @param {number} ms Milliseconds to wait
 * @returns {Promise} Promise that resolves after the wait
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a timeout promise that rejects after a specified time
 * @param {number} ms Timeout in milliseconds
 * @param {string} message Timeout error message
 * @returns {Promise} Promise that rejects on timeout
 */
export function createTimeout(ms, message = 'Operation timed out') {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms)
  })
}

/**
 * Race a promise against a timeout
 * @param {Promise} promise Promise to race
 * @param {number} timeout Timeout in milliseconds
 * @param {string} message Timeout error message
 * @returns {Promise} Promise that resolves or rejects
 */
export function withTimeout(promise, timeout, message) {
  return Promise.race([
    promise,
    createTimeout(timeout, message)
  ])
}

/**
 * Get a readable string representation of plane orientation
 * @param {string} orientation WebXR plane orientation
 * @returns {string} Human readable orientation
 */
export function formatPlaneOrientation(orientation) {
  const orientations = {
    'horizontal': 'Horizontal (Table/Floor)',
    'vertical': 'Vertical (Wall)',
    'other': 'Other'
  }
  return orientations[orientation] || 'Unknown'
}

/**
 * Get a color for plane visualization based on orientation
 * @param {string} orientation WebXR plane orientation
 * @returns {number} Color hex value
 */
export function getPlaneColor(orientation) {
  const colors = {
    'horizontal': 0x00ff00, // Green for horizontal planes
    'vertical': 0x0000ff,   // Blue for vertical planes
    'other': 0xff00ff       // Magenta for other planes
  }
  return colors[orientation] || 0xffffff
} 