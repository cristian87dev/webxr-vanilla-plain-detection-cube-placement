/**
 * HitTestManager
 * Handles WebXR hit-testing for precise surface targeting
 */

export class HitTestManager {
  constructor(session, referenceSpace) {
    console.log('🎯 [DEBUG] HitTestManager constructor')
    
    this.session = session
    this.referenceSpace = referenceSpace
    this.hitTestSources = new Map() // inputSource -> hitTestSource
    this.hitTestResults = new Map() // inputSource -> latest hit result
    this.isSupported = session.enabledFeatures?.includes('hit-test') || false
    this.isDisposed = false // ✅ NEW: Track disposal state
    
    console.log(`🎯 [DEBUG] Hit-test support: ${this.isSupported}`)
  }

  /**
   * Check if hit-testing is supported in current session
   * @returns {boolean}
   */
  isHitTestSupported() {
    return this.isSupported && !this.isDisposed
  }

  /**
   * Setup hit-test sources for active input sources
   * @param {Iterable<XRInputSource>} inputSources Active input sources
   * @returns {Promise<void>}
   */
  async setupHitTestSources(inputSources) {
    if (!this.isSupported || this.isDisposed) {
      console.log('ℹ️ [DEBUG] Hit-testing not supported or disposed, skipping setup')
      return
    }

    console.log('🔧 [DEBUG] Setting up hit-test sources...')

    for (const inputSource of inputSources) {
      if (!this.hitTestSources.has(inputSource)) {
        try {
          console.log(`🎯 [DEBUG] Creating hit-test source for ${inputSource.handedness} ${inputSource.hand ? 'hand' : 'controller'}`)
          
          const hitTestSource = await this.session.requestHitTestSource({
            space: inputSource.targetRaySpace,
            entityTypes: ['plane', 'point'] // Default to planes and points for comprehensive coverage
          })
          
          this.hitTestSources.set(inputSource, hitTestSource)
          console.log(`✅ [DEBUG] Hit-test source created for ${inputSource.handedness}`)
          
        } catch (error) {
          if (error.name === 'InvalidStateError') {
            console.warn(`⚠️ [DEBUG] Session ended during hit-test source creation for ${inputSource.handedness}`)
            return
          } else if (error.name === 'NotSupportedError') {
            console.warn(`⚠️ [DEBUG] Hit-testing not supported for ${inputSource.handedness}`)
          } else {
            console.warn(`⚠️ [DEBUG] Failed to create hit-test source for ${inputSource.handedness}:`, error)
          }
        }
      }
    }

    console.log(`✅ [DEBUG] Hit-test setup complete. ${this.hitTestSources.size} sources active`)
  }

  /**
   * Update hit-test results for all active sources
   * @param {XRFrame} frame Current XR frame
   */
  updateHitTests(frame) {
    if (!this.isSupported || this.isDisposed) return

    if (!frame.session || frame.session.ended) {
      console.warn('⚠️ [DEBUG] Attempting to use ended session for hit-testing')
      return
    }

    this.hitTestResults.clear()

    for (const [inputSource, hitTestSource] of this.hitTestSources) {
      try {
        const hitTestResults = frame.getHitTestResults(hitTestSource)
        
        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0]
          const pose = hit.getPose(this.referenceSpace)
          
          if (pose) {
            this.hitTestResults.set(inputSource, {
              pose: pose,
              inputSource: inputSource,
              timestamp: frame.predictedDisplayTime
            })
          }
        }
      } catch (error) {
        if (error.name === 'InvalidStateError') {
          console.warn(`⚠️ [DEBUG] Invalid frame state during hit-testing for ${inputSource.handedness}`)
        } else {
          console.warn(`⚠️ [DEBUG] Hit-test failed for ${inputSource.handedness}:`, error)
        }
      }
    }
  }

  /**
   * Get hit-test result for specific input source
   * @param {XRInputSource} inputSource Input source to get result for
   * @returns {Object|null} Hit result with pose and metadata
   */
  getHitTestResult(inputSource) {
    if (this.isDisposed) return null
    return this.hitTestResults.get(inputSource) || null
  }

  /**
   * Get all current hit-test results
   * @returns {Map<XRInputSource, Object>} Map of input sources to hit results
   */
  getAllHitTestResults() {
    if (this.isDisposed) return new Map()
    return new Map(this.hitTestResults)
  }

  /**
   * Clean up hit-test sources for removed input sources
   * @param {Set<XRInputSource>} activeInputSources Currently active input sources
   */
  cleanupInactiveSources(activeInputSources) {
    for (const [inputSource, hitTestSource] of this.hitTestSources) {
      if (!activeInputSources.has(inputSource)) {
        console.log(`🧹 [DEBUG] Cleaning up hit-test source for removed ${inputSource.handedness}`)
        
        try {
          hitTestSource.cancel()
        } catch (error) {
          console.warn('⚠️ [DEBUG] Error canceling hit-test source:', error)
        }
        
        this.hitTestSources.delete(inputSource)
        this.hitTestResults.delete(inputSource)
      }
    }
  }

  /**
   * Dispose of all hit-test sources
   */
  dispose() {
    if (this.isDisposed) {
      console.log('ℹ️ [DEBUG] HitTestManager already disposed')
      return
    }
    
    console.log('🧹 [DEBUG] Disposing HitTestManager...')
    
    for (const [inputSource, hitTestSource] of this.hitTestSources) {
      try {
        hitTestSource.cancel()
      } catch (error) {
        console.warn('⚠️ [DEBUG] Error canceling hit-test source during disposal:', error)
      }
    }
    
    this.hitTestSources.clear()
    this.hitTestResults.clear()
    this.isDisposed = true
    
    console.log('✅ [DEBUG] HitTestManager disposed')
  }

  /**
   * Get debug information about hit-testing state
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      isSupported: this.isSupported,
      activeHitTestSources: this.hitTestSources.size,
      currentHitResults: this.hitTestResults.size,
      inputSources: Array.from(this.hitTestSources.keys()).map(source => ({
        handedness: source.handedness,
        type: source.hand ? 'hand' : 'controller'
      }))
    }
  }
} 