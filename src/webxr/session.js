/**
 * WebXR Session Management
 * Handles WebXR session lifecycle for Meta Quest 3 plane detection
 */
export class WebXRSession {
  constructor() {
    console.log('🔧 [DEBUG] WebXRSession constructor')
    this.session = null
    this.isSupported = false
  }

  /**
   * Check if WebXR and plane detection are supported
   * @returns {Promise<boolean>}
   */
  async checkSupport() {
    console.log('🔍 [DEBUG] WebXRSession.checkSupport() starting...')
    try {
      if (!navigator.xr) {
        console.warn('⚠️ [DEBUG] WebXR not available in this browser')
        return false
      }
      console.log('✅ [DEBUG] navigator.xr is available')

      // Check if immersive-ar is supported
      const arSupported = await navigator.xr.isSessionSupported('immersive-ar')
      console.log(`🔍 [DEBUG] Immersive AR supported: ${arSupported}`)
      if (!arSupported) {
        console.warn('⚠️ [DEBUG] Immersive AR not supported on this device')
        return false
      }

      this.isSupported = true
      console.log('✅ [DEBUG] WebXR support check passed')
      return true
    } catch (error) {
      console.error('❌ [DEBUG] Error checking WebXR support:', error)
      return false
    }
  }

  /**
   * Check if device requires room setup (Meta Quest 3 specific)
   * @returns {boolean}
   */
  detectsQuestDevice() {
    // Check user agent for Quest indicators
    const userAgent = navigator.userAgent.toLowerCase()
    const isQuest = userAgent.includes('quest') || userAgent.includes('oculus')
    console.log(`🥽 [DEBUG] Quest device detected: ${isQuest}`)
    return isQuest
  }

  /**
   * Attempt to initiate room capture for Quest devices
   * @param {XRSession} session
   */
  async initiateRoomCaptureIfNeeded(session) {
    if (!this.detectsQuestDevice()) {
      console.log('ℹ️ [DEBUG] Not a Quest device, skipping room capture')
      return
    }

    try {
      if (typeof session.initiateRoomCapture === 'function') {
        console.log('🏠 [DEBUG] Attempting to initiate room capture for Quest device...')
        await session.initiateRoomCapture()
        console.log('✅ [DEBUG] Room capture initiated successfully')
      } else {
        console.log('⚠️ [DEBUG] initiateRoomCapture not available on this session')
        console.log('💡 [DEBUG] Quest devices may require manual room setup before plane detection works')
      }
    } catch (error) {
      console.warn('⚠️ [DEBUG] Room capture failed:', error)
      console.log('💡 [DEBUG] Manual room setup may be required in Quest settings')
    }
  }

  /**
   * Create WebXR session with plane detection
   * @param {Object} options Session options
   * @returns {Promise<XRSession>} WebXR session
   */
  async createSession(options = {}) {
    console.log('🚀 [DEBUG] WebXRSession.createSession() starting...')
    console.log('📊 [DEBUG] Session options:', options)
    
    try {
      // Check if we're on Quest 3 which requires room capture
      const isQuest3 = this.detectsQuest3Device()
      console.log(`🥽 [DEBUG] Quest 3 detected: ${isQuest3}`)
      
      // Request session with plane detection
      console.log('🔧 [DEBUG] Requesting WebXR session...')
      this.session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['local'],
        optionalFeatures: ['plane-detection', 'hit-test', 'anchors']
      })
      console.log('✅ [DEBUG] WebXR session created successfully')
      console.log('📊 [DEBUG] Session features:', this.session.enabledFeatures)
      
      // Check if plane detection is actually enabled
      const hasPlaneDetection = this.session.enabledFeatures?.includes('plane-detection')
      console.log(`🎯 [DEBUG] Plane detection enabled: ${hasPlaneDetection}`)
      
      if (hasPlaneDetection && isQuest3) {
        console.log('🏠 [DEBUG] Quest 3 detected - room capture will be required')
        console.log('💡 [DEBUG] Will prompt for room capture after session starts')
      }
      
      return this.session
      
    } catch (error) {
      console.error('❌ [DEBUG] Failed to create WebXR session:', error)
      
      // Provide more specific error messages for Quest 3
      if (error.name === 'NotSupportedError') {
        if (this.detectsQuest3Device()) {
          console.error('🥽 [DEBUG] Quest 3 may need browser/OS update for plane detection')
          console.error('💡 [DEBUG] Required: Horizon OS ≥ v64, Meta Quest Browser ≥ 34.5')
        }
      }
      
      throw error
    }
  }

  /**
   * Check if device is specifically Quest 3
   * @returns {boolean}
   */
  detectsQuest3Device() {
    const userAgent = navigator.userAgent.toLowerCase()
    const isQuest3 = userAgent.includes('quest 3') || userAgent.includes('quest3')
    console.log(`🔍 [DEBUG] Quest 3 detection - User Agent: ${userAgent}`)
    console.log(`🎯 [DEBUG] Quest 3 detected: ${isQuest3}`)
    return isQuest3
  }

  /**
   * Initiate room capture for Quest 3 plane detection
   * @param {XRSession} session The WebXR session
   * @returns {Promise<boolean>} Success status
   */
  async initiateRoomCapture(session = this.session) {
    console.log('🏠 [DEBUG] Attempting to initiate room capture...')
    
    if (!session) {
      console.error('❌ [DEBUG] No session available for room capture')
      return false
    }
    
    // Check if session supports plane detection
    const hasPlaneDetection = session.enabledFeatures?.includes('plane-detection')
    if (!hasPlaneDetection) {
      console.warn('⚠️ [DEBUG] Session does not have plane detection enabled')
      return false
    }
    
    try {
      // Check if initiateRoomCapture method exists
      if (typeof session.initiateRoomCapture === 'function') {
        console.log('🔧 [DEBUG] Calling session.initiateRoomCapture()...')
        
        // This will prompt the user to scan their room
        await session.initiateRoomCapture()
        
        console.log('✅ [DEBUG] Room capture initiated successfully!')
        console.log('👀 [DEBUG] User should now see room scanning UI')
        console.log('💡 [DEBUG] Point device at surfaces to map the room')
        
        return true
        
      } else {
        console.warn('⚠️ [DEBUG] initiateRoomCapture method not available')
        console.log('💡 [DEBUG] This may indicate older browser version')
        return false
      }
      
    } catch (error) {
      console.error('❌ [DEBUG] Failed to initiate room capture:', error)
      console.error('🔍 [DEBUG] Error details:', {
        name: error.name,
        message: error.message
      })
      
      // Provide helpful error messages
      if (error.name === 'NotAllowedError') {
        console.error('🚫 [DEBUG] User denied spatial permission')
        console.log('💡 [DEBUG] User needs to allow spatial data access')
      } else if (error.name === 'InvalidStateError') {
        console.error('🔄 [DEBUG] Room capture already in progress or completed')
      }
      
      return false
    }
  }

  /**
   * Check room capture status
   * @param {XRSession} session The WebXR session
   * @returns {string} Room capture status
   */
  getRoomCaptureStatus(session = this.session) {
    if (!session) return 'no-session'
    
    // Check if we have any detected planes
    // Note: This is a heuristic since there's no direct API to check room capture status
    console.log('🔍 [DEBUG] Checking room capture status...')
    
    const hasPlaneDetection = session.enabledFeatures?.includes('plane-detection')
    if (!hasPlaneDetection) {
      return 'plane-detection-disabled'
    }
    
    // We'll need to check this during the render loop
    return 'unknown'
  }

  /**
   * End the current session
   * @returns {Promise<void>}
   */
  async endSession() {
    console.log('🛑 [DEBUG] WebXRSession.endSession() called')
    if (this.session) {
      try {
        await this.session.end()
        console.log('✅ [DEBUG] WebXR session ended successfully')
      } catch (error) {
        console.error('❌ [DEBUG] Error ending WebXR session:', error)
      }
    } else {
      console.log('ℹ️ [DEBUG] No active session to end')
    }
  }

  /**
   * Get the current session
   * @returns {XRSession|null}
   */
  getCurrentSession() {
    console.log('📊 [DEBUG] Getting current session:', this.session ? 'active' : 'null')
    return this.session
  }

  /**
   * Check if session is active
   * @returns {boolean}
   */
  isSessionActive() {
    const isActive = this.session && !this.session.ended
    console.log('🔍 [DEBUG] Checking if session is active:', isActive)
    return isActive
  }
} 