import './style.css'
import * as THREE from 'three'
import { WebXRSession } from './webxr/session.js'
import { WebXRRenderer } from './webxr/renderer.js'
import { HitTestManager } from './interaction/HitTestManager.js'
import { CursorManager } from './interaction/CursorManager.js'
import { PlaneVisualizer } from './interaction/PlaneVisualizer.js'
import { multiplyMatrixAndPoint, getPlaneCenter } from './utils/math.js'

class WebXRPlaneDetectionApp {
  constructor() {
    // Configuration constants
    this.CUBE_HEIGHT_OFFSET = 0.1  // 10cm above surface
    this.MAX_PLACEMENT_DISTANCE = 2.0  // Maximum distance for plane selection
    this.LOG_FREQUENCY_FRAMES = 120  // Log every 2 seconds at 60fps
    
    this.session = null
    this.refSpace = null
    this.renderer = null
    this.scene = null
    this.camera = null
    this.cube = null
    
    // ✅ ENHANCED: Multi-state placement system with repositioning
    this.placementState = 'scanning' // scanning | targeting | preview | placed | repositioning
    this.isPlaced = false // Keep for backward compatibility
    
    // Anchor support for improved stability
    this.cubeAnchor = null
    this.trackAnchoredCube = false
    
    // Plane detection for manual placement
    this.availablePlanes = []
    
    // ✅ ENHANCED: Better input source tracking
    this.activeInputSources = new Map() // inputSource -> metadata
    this.pendingPlacements = new Map() // Track pending placements by input source
    
    // ✅ NEW: Track hit-test setup to prevent race conditions
    this.hitTestSetupInProgress = false
    this.pendingHitTestSources = new Set() // Track sources being set up
    
    // ✅ NEW: Scene organization for visual objects
    this.sceneGroups = {
      cursors: null,      // Will hold cursor objects
      planeVisuals: null, // Will hold plane highlight objects
      content: null       // Will hold cube and other content
    }
    
    // ✅ NEW: Visual object tracking
    this.cursors = new Map()         // inputSource -> cursor object
    this.planeHighlights = new Map() // plane -> highlight object
    this.currentTargetPlane = null   // Currently targeted plane
    
    // Debug counters
    this.frameCount = 0
    this.lastLogTime = 0
    this.totalPlanesDetected = 0
    
    this.webxrSession = new WebXRSession()
    this.webxrRenderer = new WebXRRenderer()
    this.hitTestManager = null // Will be initialized when session starts
    this.cursorManager = null // Will be initialized when session starts
    this.planeVisualizer = null // Will be initialized when session starts
    
    console.log('🚀 [DEBUG] WebXRPlaneDetectionApp constructor started with enhanced state management')
    this.init()
  }

  async init() {
    console.log('🔧 [DEBUG] Starting app initialization...')
    this.setupUI()
    await this.checkWebXRSupport()
    console.log('✅ [DEBUG] App initialization complete')
  }

  setupUI() {
    console.log('🎨 [DEBUG] Setting up UI...')
    const startButton = document.getElementById('start-ar')
    const statusDiv = document.getElementById('status')
    
    startButton.addEventListener('click', () => {
      console.log('🎮 [DEBUG] Start AR button clicked!')
      this.startAR()
    })
    
    // Store references for later use
    this.ui = { startButton, statusDiv }
    console.log('✅ [DEBUG] UI setup complete')
  }

  async checkWebXRSupport() {
    console.log('🔍 [DEBUG] Checking WebXR support...')
    const { startButton, statusDiv } = this.ui
    
    try {
      if (!navigator.xr) {
        throw new Error('WebXR not supported in this browser')
      }
      console.log('✅ [DEBUG] navigator.xr is available')

      const isARSupported = await navigator.xr.isSessionSupported('immersive-ar')
      console.log(`🔍 [DEBUG] Immersive AR supported: ${isARSupported}`)
      if (!isARSupported) {
        throw new Error('Immersive AR not supported on this device')
      }

      // Check if this is Quest 3 for specific guidance
      const isQuest3 = this.webxrSession.detectsQuest3Device()
      console.log(`🥽 [DEBUG] Quest 3 device detected: ${isQuest3}`)

      // ✅ FIXED: Only check basic support, don't create test sessions
      // Creating sessions requires user activation (button click)
      console.log('✅ [DEBUG] Basic WebXR support confirmed')
      
      if (isQuest3) {
        statusDiv.textContent = 'Quest 3 ready! Click to start AR with room capture 🏠'
        console.log('🏠 [DEBUG] Quest 3: Will use room capture when session starts')
      } else {
        statusDiv.textContent = 'WebXR ready! Click to start AR experience 🎯'
        console.log('🎉 [DEBUG] WebXR is supported on this device!')
      }
      
      startButton.textContent = 'Start AR Experience'
      startButton.disabled = false
      
    } catch (error) {
      console.error('❌ [DEBUG] WebXR Support Check Failed:', error)
      statusDiv.textContent = `❌ ${error.message}`
      startButton.textContent = 'WebXR Not Available'
      
      // Provide helpful guidance for Quest 3 users
      const isQuest3 = this.webxrSession.detectsQuest3Device()
      if (isQuest3 && error.message.includes('not supported')) {
        console.log('💡 [DEBUG] Quest 3 troubleshooting:')
        console.log('   1. Update to Horizon OS v64 or later')
        console.log('   2. Update Meta Quest Browser to v34.5 or later')
        console.log('   3. Make sure you\'re using HTTPS')
        console.log('   4. Restart the browser and try again')
      }
    }
  }

  async startAR() {
    console.log('🥽 [DEBUG] Starting AR session...')
    const { startButton, statusDiv } = this.ui
    
    try {
      startButton.disabled = true
      statusDiv.textContent = 'Initializing AR session...'
      
      // ✅ NOW we can create sessions - user clicked button (user activation)
      console.log('🔧 [DEBUG] Creating WebXR session with user activation...')
      this.session = await this.webxrSession.createSession({
        requiredFeatures: ['local'],
        optionalFeatures: ['plane-detection', 'hit-test', 'anchors']
      })
      console.log('✅ [DEBUG] WebXR session created successfully')
      console.log('📊 [DEBUG] Session object:', this.session)
      
      // Now we can check what features were actually enabled
      console.log('🔍 [DEBUG] Checking actual session capabilities...')
      const hasPlaneDetection = this.session.enabledFeatures?.includes('plane-detection')
      const hasHitTest = this.session.enabledFeatures?.includes('hit-test')
      const hasAnchors = this.session.enabledFeatures?.includes('anchors')
      
      console.log(`🎯 [DEBUG] Plane detection enabled: ${hasPlaneDetection}`)
      console.log(`🎯 [DEBUG] Hit test enabled: ${hasHitTest}`)
      console.log(`⚓ [DEBUG] Anchors enabled: ${hasAnchors}`)
      
      if (hasPlaneDetection) {
        // Check if this is Quest 3 which requires room capture
        const isQuest3 = this.webxrSession.detectsQuest3Device()
        
        if (isQuest3) {
          console.log('🏠 [DEBUG] Quest 3 detected - initiating room capture...')
          statusDiv.textContent = '🏠 Setting up room mapping...'
          
          // Try to initiate room capture
          const roomCaptureSuccess = await this.webxrSession.initiateRoomCapture(this.session)
          
          if (roomCaptureSuccess) {
            console.log('✅ [DEBUG] Room capture initiated successfully')
            statusDiv.textContent = '👀 Scan your room - point at floors, tables, walls'
          } else {
            console.warn('⚠️ [DEBUG] Room capture failed or not available')
            statusDiv.textContent = '⚠️ Room setup required - check device settings'
          }
        } else {
          console.log('ℹ️ [DEBUG] Non-Quest 3 device - proceeding with standard plane detection')
          statusDiv.textContent = 'AR Active - Plane detection enabled'
        }
      } else {
        console.warn('⚠️ [DEBUG] Plane detection not available in this session')
        statusDiv.textContent = '⚠️ Plane detection not supported - basic AR only'
        
        // Provide guidance for Quest 3 users
        const isQuest3 = this.webxrSession.detectsQuest3Device()
        if (isQuest3) {
          console.log('💡 [DEBUG] Quest 3: May need browser/OS update for plane detection')
          statusDiv.textContent = '⚠️ Quest 3: Update browser for plane detection'
        }
      }
      
      console.log('📊 [DEBUG] Session supported features:', {
        hasInputSources: 'inputSources' in this.session,
        hasRenderState: 'renderState' in this.session,
        hasEnvironmentBlendMode: 'environmentBlendMode' in this.session,
        hasVisibilityState: 'visibilityState' in this.session,
        environmentBlendMode: this.session.environmentBlendMode,
        visibilityState: this.session.visibilityState,
        enabledFeatures: this.session.enabledFeatures
      })
      
      // Setup Three.js renderer
      console.log('🎨 [DEBUG] Initializing Three.js renderer...')
      await this.webxrRenderer.initialize(this.session)
      this.renderer = this.webxrRenderer.renderer
      this.scene = this.webxrRenderer.scene
      this.camera = this.webxrRenderer.camera
      console.log('✅ [DEBUG] Three.js renderer initialized')
      
      // ✅ NEW: Setup scene organization groups
      this.setupSceneGroups()
      
      // Create the cube to place on detected planes
      console.log('📦 [DEBUG] Creating placement cube...')
      this.createCube()
      
      // Get reference space
      console.log('🌐 [DEBUG] Requesting reference space...')
      this.refSpace = await this.session.requestReferenceSpace('local')
      console.log('✅ [DEBUG] Reference space obtained:', this.refSpace)
      
      // ✅ NEW: Initialize hit-testing for precise cursor positioning
      console.log('🎯 [DEBUG] Initializing hit-test manager...')
      this.hitTestManager = new HitTestManager(this.session, this.refSpace)
      console.log('✅ [DEBUG] Hit-test manager initialized')
      
      // ✅ NEW: Initialize cursor manager for visual feedback
      console.log('🎨 [DEBUG] Initializing cursor manager...')
      this.cursorManager = new CursorManager(this.scene, this.camera, this.sceneGroups)
      console.log('✅ [DEBUG] Cursor manager initialized')
      
      // ✅ NEW: Initialize plane visualizer for surface highlighting
      console.log('🎭 [DEBUG] Initializing plane visualizer...')
      this.planeVisualizer = new PlaneVisualizer(this.scene, this.sceneGroups)
      console.log('✅ [DEBUG] Plane visualizer initialized')
      
      // Set up input event listeners for proper hand/controller detection
      this.setupInputEventListeners()
      
      // Reset debug counters
      this.frameCount = 0
      this.lastLogTime = performance.now()
      this.totalPlanesDetected = 0
      
      // Start the render loop
      console.log('🔄 [DEBUG] Starting render loop...')
      this.session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame))
      
      // Hide UI overlay
      document.getElementById('ui-overlay').style.display = 'none'
      
      // Set final status based on plane detection availability
      if (hasPlaneDetection) {
        statusDiv.textContent = 'AR Active - Looking for surfaces...'
      } else {
        statusDiv.textContent = 'AR Active - Basic mode (no plane detection)'
      }
      
      console.log('🎉 [DEBUG] AR session started successfully!')
      
      if (hasPlaneDetection) {
        console.log('🎯 [DEBUG] Plane detection enabled - looking for surfaces...')
        if (this.webxrSession.detectsQuest3Device()) {
          console.log('💡 [DEBUG] Quest 3: Complete room scan to see planes')
        }
      } else {
        console.log('⚠️ [DEBUG] Plane detection not available - basic AR mode only')
      }
      
      // Handle session end
      this.session.addEventListener('end', () => {
        console.log('🛑 [DEBUG] AR session ended')
        
        // Clean up event listeners
        this.cleanupEventListeners()
        
        // ✅ FIXED: Clean up hit-test manager to prevent memory leaks
        if (this.hitTestManager) {
          console.log('🧹 [DEBUG] Disposing hit-test manager...')
          this.hitTestManager.dispose()
          this.hitTestManager = null
        }
        
        // ✅ NEW: Clean up cursor manager to prevent memory leaks
        if (this.cursorManager) {
          console.log('🧹 [DEBUG] Disposing cursor manager...')
          this.cursorManager.dispose()
          this.cursorManager = null
        }
        
        // ✅ NEW: Clean up plane visualizer to prevent memory leaks
        if (this.planeVisualizer) {
          console.log('🧹 [DEBUG] Disposing plane visualizer...')
          this.planeVisualizer.dispose()
          this.planeVisualizer = null
        }
        
        // Clean up anchor if exists
        if (this.cubeAnchor) {
          console.log('🧹 [DEBUG] Cleaning up cube anchor...')
          this.cubeAnchor = null
          this.trackAnchoredCube = false
        }
        
        // Reset UI
        document.getElementById('ui-overlay').style.display = 'flex'
        startButton.disabled = false
        startButton.textContent = 'Start AR Experience'
        statusDiv.textContent = 'AR session ended'
        
        // Reset state
        this.placementState = 'scanning'
        this.isPlaced = false
        this.availablePlanes = []
        this.activeInputSources.clear()
        this.pendingPlacements.clear()
        
        // ✅ FIXED: Reset hit-test tracking state to prevent pollution
        this.hitTestSetupInProgress = false
        this.pendingHitTestSources.clear()
        
        if (this.cube) {
          this.cube.visible = false
          // ✅ NEW: Reset cube material state
          if (this.cube.material) {
            this.cube.material.transparent = false
            this.cube.material.opacity = 1.0
          }
        }
      })
      
    } catch (error) {
      console.error('❌ [DEBUG] Failed to start AR:', error)
      console.error('❌ [DEBUG] Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      })
      
      // Provide more specific error messages for Quest 3
      let errorMessage = `Failed to start AR: ${error.message}`
      
      if (error.name === 'NotSupportedError') {
        if (this.webxrSession.detectsQuest3Device()) {
          errorMessage = 'Quest 3 needs browser update (Horizon OS ≥ v64, Browser ≥ 34.5)'
        } else {
          errorMessage = 'AR not supported on this device'
        }
      } else if (error.name === 'NotAllowedError') {
        errorMessage = 'Please allow spatial/camera permissions for AR'
      } else if (error.name === 'SecurityError') {
        errorMessage = 'AR requires HTTPS - try https:// URL'
      }
      
      statusDiv.textContent = `❌ ${errorMessage}`
      startButton.disabled = false
    }
  }

  createCube() {
    console.log('📦 [DEBUG] Creating placement cube...')
    
    // Create cube geometry and material
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2)
    const material = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
    
    this.cube = new THREE.Mesh(geometry, material)
    this.cube.visible = false // Initially hidden until placed
    this.cube.castShadow = true
    this.cube.receiveShadow = true
    
    // ✅ ENHANCED: Add to content group for better organization
    this.sceneGroups.content.add(this.cube)
    
    console.log('✅ [DEBUG] Cube created and added to content group')
  }

  placeCubeOnPlane(plane, frame) {
    console.log('🎯 [DEBUG] Attempting to place cube on plane...')
    
    if (!plane || !frame || !this.refSpace) {
      console.warn('⚠️ [DEBUG] Missing required parameters for cube placement')
      return false
    }

    try {
      // Get plane pose in our reference space
      const planePose = frame.getPose(plane.planeSpace, this.refSpace)
      if (!planePose) {
        console.warn('⚠️ [DEBUG] Could not get plane pose')
        return false
      }

      // Debug plane information
      console.log('🛩️ [DEBUG] Plane info:', {
        orientation: plane.orientation,
        polygonVertices: plane.polygon?.length || 0
      })
      console.log('📐 [DEBUG] Plane pose matrix:', planePose.transform.matrix)

      // Calculate cube position (center of plane, slightly above surface)
      const planeMatrix = planePose.transform.matrix
      const planeCenter = getPlaneCenter(plane.polygon)
      
      // ✅ FIXED: Transform plane center to world coordinates first
      const worldPlaneCenter = multiplyMatrixAndPoint(planeMatrix, [
        planeCenter.x,
        planeCenter.y, // Don't add offset here - do it in world space
        planeCenter.z,
        1.0
      ])

      // ✅ FIXED: For horizontal planes, add offset upward in world Y
      // For vertical planes, we might need a different approach
      let cubePosition
      
      if (plane.orientation === 'horizontal') {
        // For horizontal planes, offset upward in world Y-axis
        cubePosition = [
          worldPlaneCenter[0],
          worldPlaneCenter[1] + this.CUBE_HEIGHT_OFFSET, // Add offset in world space
          worldPlaneCenter[2]
        ]
        console.log('📱 [DEBUG] Horizontal plane - adding Y offset in world coordinates')
      } else {
        // For vertical planes, place cube slightly in front of the surface
        // Use the plane's normal vector direction
        cubePosition = [
          worldPlaneCenter[0],
          worldPlaneCenter[1], // Keep same height for vertical planes
          worldPlaneCenter[2] + this.CUBE_HEIGHT_OFFSET // Offset forward from wall
        ]
        console.log('🏛️ [DEBUG] Vertical plane - adding Z offset in world coordinates')
      }

      this.cube.position.set(cubePosition[0], cubePosition[1], cubePosition[2])
      this.cube.visible = true
      this.placementState = 'placed'
      this.isPlaced = true

      console.log('✅ [DEBUG] Cube placed successfully!')
      console.log('📍 [DEBUG] Plane center (world):', {
        x: worldPlaneCenter[0].toFixed(3),
        y: worldPlaneCenter[1].toFixed(3),
        z: worldPlaneCenter[2].toFixed(3)
      })
      console.log('📍 [DEBUG] Cube position (world):', {
        x: cubePosition[0].toFixed(3),
        y: cubePosition[1].toFixed(3),
        z: cubePosition[2].toFixed(3),
        offsetApplied: `+${this.CUBE_HEIGHT_OFFSET}m in ${plane.orientation === 'horizontal' ? 'Y' : 'Z'}`,
        planeOrientation: plane.orientation
      })

      // Try to create an anchor for better stability (future feature)
      this.tryCreateAnchor(planePose, frame)

      return true
    } catch (error) {
      console.error('❌ [DEBUG] Error placing cube:', error)
      return false
    }
  }

  /**
   * Attempt to create an anchor for the placed cube (future WebXR feature)
   * @param {XRPose} planePose Position where cube was placed
   * @param {XRFrame} frame Current XR frame
   */
  async tryCreateAnchor(planePose, frame) {
    console.log('⚓ [DEBUG] Attempting to create anchor for cube stability...')
    
    try {
      // Check if anchors are supported
      const session = frame.session
      const hasAnchors = session.enabledFeatures?.includes('anchors')
      
      if (!hasAnchors) {
        console.log('ℹ️ [DEBUG] Anchors not available in this session')
        return
      }

      // Check if createAnchor method exists (future API)
      if (typeof session.createAnchor === 'function') {
        console.log('🔧 [DEBUG] Creating anchor at cube position...')
        
        const anchor = await session.createAnchor(planePose, this.refSpace)
        this.cubeAnchor = anchor
        
        console.log('✅ [DEBUG] Anchor created successfully!')
        console.log('⚓ [DEBUG] Cube is now anchored to the real world')
        
        // Set up anchor tracking
        this.trackAnchoredCube = true
        
      } else {
        console.log('ℹ️ [DEBUG] createAnchor method not yet available')
      }
      
    } catch (error) {
      console.warn('⚠️ [DEBUG] Failed to create anchor:', error)
      console.log('💡 [DEBUG] Falling back to standard positioning')
    }
  }

  /**
   * ✅ NEW: Place cube at hit-test result location
   * @param {Object} hitResult Hit-test result with pose and metadata
   * @param {XRFrame} frame Current XR frame
   * @returns {boolean} True if placement successful
   */
  placeCubeAtHitTest(hitResult, frame) {
    try {
      console.log('🎯 [DEBUG] Placing cube at hit-test location...')
      
      const { pose } = hitResult
      const position = pose.transform.position
      const orientation = pose.transform.orientation
      
      // Apply height offset above the hit surface
      const cubePosition = [
        position.x,
        position.y + this.CUBE_HEIGHT_OFFSET,
        position.z
      ]
      
      console.log('📍 [DEBUG] Hit-test placement position:', {
        original: [position.x, position.y, position.z],
        withOffset: cubePosition,
        orientation: [orientation.x, orientation.y, orientation.z, orientation.w]
      })
      
      // Position the cube
      this.cube.position.set(cubePosition[0], cubePosition[1], cubePosition[2])
      this.cube.visible = true
      this.placementState = 'placed'
      this.isPlaced = true

      console.log('✅ [DEBUG] Cube placed successfully at hit-test location!')
      
      // Try to create anchor for stability
      this.tryCreateAnchor(pose, frame).catch(error => {
        console.warn('⚠️ [DEBUG] Failed to create anchor for hit-test placement:', error)
      })
      
      return true
      
    } catch (error) {
      console.error('❌ [DEBUG] Error placing cube at hit-test location:', error)
      return false
    }
  }

  /**
   * Update cube position using anchor if available
   * @param {XRFrame} frame Current XR frame
   */
  updateAnchoredCube(frame) {
    if (!this.trackAnchoredCube || !this.cubeAnchor) return

    try {
      // Get current anchor pose
      const anchorPose = frame.getPose(this.cubeAnchor.anchorSpace, this.refSpace)
      
      if (anchorPose) {
        // Update cube position to match anchor
        const pos = anchorPose.transform.position
        const rot = anchorPose.transform.orientation
        
        // ✅ FIXED: Add offset in world coordinates for anchored cube too
        this.cube.position.set(
          pos.x, 
          pos.y + this.CUBE_HEIGHT_OFFSET, // Offset in world Y
          pos.z
        )
        this.cube.quaternion.set(rot.x, rot.y, rot.z, rot.w)
        
        console.log('⚓ [DEBUG] Cube position updated via anchor')
      }
      
    } catch (error) {
      console.warn('⚠️ [DEBUG] Error updating anchored cube:', error)
      this.trackAnchoredCube = false // Disable anchor tracking on error
    }
  }

  onXRFrame(time, frame) {
    const session = frame.session
    session.requestAnimationFrame((time, frame) => this.onXRFrame(time, frame))

    // Update debug counters
    this.frameCount++
    
    // ✅ FIXED: Reduce console logging frequency to prevent memory retention
    // Log frame info every 5 seconds instead of 2 seconds
    if (time - this.lastLogTime > 5000) {
      const fps = this.frameCount / ((time - this.lastLogTime) / 1000)
      console.log(`📊 [DEBUG] Frame stats: ${this.frameCount} frames, ${fps.toFixed(1)} FPS, ${this.totalPlanesDetected} total planes detected`)
      // ✅ FIXED: Don't log the entire frame object - just essential info
      console.log(`🔍 [DEBUG] Frame essentials:`, {
        hasDetectedPlanes: 'detectedPlanes' in frame,
        sessionActive: frame.session && !frame.session.ended,
        placementState: this.placementState
      })
      this.frameCount = 0
      this.lastLogTime = time
    }

    // ✅ ENHANCED: Update interaction systems (during scanning and repositioning)
    if (this.placementState === 'scanning' || this.placementState === 'repositioning') {
      this.updateInputSources(frame)
      
      // ✅ FIXED: Only update hit-testing if we have active input sources (performance optimization)
      if (this.hitTestManager && this.hitTestManager.isHitTestSupported() && this.activeInputSources.size > 0) {
        const debugInfo = this.hitTestManager.getDebugInfo()
        if (debugInfo.activeHitTestSources > 0) {
          this.hitTestManager.updateHitTests(frame)
        }
      }
      
      // ✅ FIXED: Only update visual systems if we have active input sources
      if (this.activeInputSources.size > 0) {
        // Update cursors based on hit-test results
        if (this.cursorManager && this.hitTestManager) {
          const hitTestResults = this.hitTestManager.getAllHitTestResults()
          if (hitTestResults.size > 0) {
            this.cursorManager.updateCursors(hitTestResults, time)
          } else {
            this.cursorManager.hideAllCursors()
          }
        }
        
        // Update plane highlighting based on hit-test results
        if (this.planeVisualizer && this.hitTestManager && this.availablePlanes.length > 0) {
          const hitTestResults = this.hitTestManager.getAllHitTestResults()
          if (hitTestResults.size > 0) {
            this.planeVisualizer.updatePlaneHighlighting(
              hitTestResults, 
              this.availablePlanes, 
              frame, 
              this.refSpace, 
              time
            )
          } else {
            this.planeVisualizer.clearAllHighlights()
          }
        }
      } else {
        // ✅ FIXED: Clear visual feedback when no input sources (performance optimization)
        if (this.cursorManager) {
          this.cursorManager.hideAllCursors()
        }
        if (this.planeVisualizer) {
          this.planeVisualizer.clearAllHighlights()
        }
      }
    }

    // Check for detected planes (always scan, even after placement)
    this.scanForPlanes(frame)
    
    // Update cube position using anchor if available (after placement)
    if (this.placementState === 'placed') {
      this.updateAnchoredCube(frame)
    }

    // Render the scene
    this.renderer.clearDepth()
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Scan for planes and store them (separated from placement logic)
   * @param {XRFrame} frame Current XR frame
   */
  scanForPlanes(frame) {
    // Check if frame has detectedPlanes property
    if (!('detectedPlanes' in frame)) {
      // Provide helpful guidance for Quest 3 users
      if (this.frameCount % (this.LOG_FREQUENCY_FRAMES * 3) === 0) { // Log every 6 seconds
        const isQuest3 = this.webxrSession.detectsQuest3Device()
        if (isQuest3) {
          console.log('💡 [DEBUG] Quest 3: No planes detected - ensure room capture is completed')
          console.log('🏠 [DEBUG] Try moving device around to scan tables, floors, and walls')
        } else {
          console.log('ℹ️ [DEBUG] No detectedPlanes property available in frame')
        }
      }
      return
    }
    
    const planes = frame.detectedPlanes
    if (!planes || planes.size === 0) {
      // Provide specific guidance when no planes are found
      if (this.frameCount % (this.LOG_FREQUENCY_FRAMES * 2) === 0) { // Log every 4 seconds
        const isQuest3 = this.webxrSession.detectsQuest3Device()
        if (isQuest3) {
          console.log('🔍 [DEBUG] Quest 3: No planes found - room capture may be incomplete')
          this.ui.statusDiv.textContent = '🏠 Complete room scan by pointing at all surfaces'
        } else {
          console.log('🔍 [DEBUG] No planes detected - scanning environment...')
          this.ui.statusDiv.textContent = 'AR Active - Scanning for surfaces...'
        }
      }
      return
    }
    
    // Store detected planes for manual selection
    const horizontalPlanes = Array.from(planes).filter(plane => plane.orientation === 'horizontal')
    const verticalPlanes = Array.from(planes).filter(plane => plane.orientation === 'vertical')
    
    this.availablePlanes = horizontalPlanes
    this.totalPlanesDetected = Math.max(this.totalPlanesDetected, planes.size)
    
    if (this.frameCount % this.LOG_FREQUENCY_FRAMES === 0) { // Log every 2 seconds at 60fps
      console.log(`🎯 [DEBUG] Found ${horizontalPlanes.length} horizontal surfaces available for placement`)
      console.log(`📊 [DEBUG] Total planes: ${planes.size} (${horizontalPlanes.length} horizontal, ${verticalPlanes.length} vertical)`)
      
      // Update UI based on plane availability
      if (horizontalPlanes.length > 0) {
        if (this.placementState === 'scanning') {
          this.ui.statusDiv.textContent = `✅ Found ${horizontalPlanes.length} surfaces - point and select to place cube`
        }
      } else if (verticalPlanes.length > 0) {
        this.ui.statusDiv.textContent = `📱 Found ${verticalPlanes.length} walls - looking for tables/floors...`
      }
    }
    
    // First time detecting planes - celebrate!
    if (this.availablePlanes.length > 0 && this.totalPlanesDetected === planes.size && this.frameCount < this.LOG_FREQUENCY_FRAMES * 2) {
      console.log('🎉 [DEBUG] First planes detected successfully!')
      
      const isQuest3 = this.webxrSession.detectsQuest3Device()
      if (isQuest3) {
        console.log('✅ [DEBUG] Quest 3 room capture working correctly')
      }
    }
  }

  /**
   * Find the plane closest to the pointing direction
   * @param {DOMPointReadOnly} pointingPosition Where user is pointing
   * @param {XRFrame} frame Current XR frame
   * @returns {XRPlane|null} Closest suitable plane
   */
  findClosestPlane(pointingPosition, frame) {
    if (!this.availablePlanes || this.availablePlanes.length === 0) return null

    let closestPlane = null
    let closestDistance = Infinity

    for (const plane of this.availablePlanes) {
      try {
        // Get plane center in world coordinates
        const planePose = frame.getPose(plane.planeSpace, this.refSpace)
        if (!planePose) continue

        const planeCenter = getPlaneCenter(plane.polygon)
        const worldPlanePos = multiplyMatrixAndPoint(planePose.transform.matrix, [
          planeCenter.x, planeCenter.y, planeCenter.z, 1.0
        ])

        // Calculate distance from pointing position to plane center
        const distance = Math.sqrt(
          Math.pow(pointingPosition.x - worldPlanePos[0], 2) +
          Math.pow(pointingPosition.y - worldPlanePos[1], 2) +
          Math.pow(pointingPosition.z - worldPlanePos[2], 2)
        )

        if (distance < closestDistance) {
          closestDistance = distance
          closestPlane = plane
        }
      } catch (error) {
        console.warn('⚠️ [DEBUG] Error calculating plane distance:', error)
      }
    }

    console.log(`📏 [DEBUG] Closest plane distance: ${closestDistance.toFixed(2)}m`)
    return closestDistance < this.MAX_PLACEMENT_DISTANCE ? closestPlane : null // Max 2 meter range
  }

  /**
   * Set up proper WebXR input event listeners
   */
  setupInputEventListeners() {
    console.log('🎮 [DEBUG] Setting up WebXR input event listeners...')
    
    // Store event handlers for cleanup
    this.selectHandler = (event) => {
      console.log('👆 [DEBUG] Select event received:', {
        handedness: event.inputSource.handedness,
        targetRayMode: event.inputSource.targetRayMode,
        profiles: event.inputSource.profiles
      })
      
      if (this.placementState === 'scanning') {
        const inputType = event.inputSource.hand ? 'hand' : 'controller'
        console.log(`✨ [DEBUG] Processing ${inputType} select event for placement`)
        this.attemptPlacement(event.inputSource, event.frame, inputType)
      } else if (this.placementState === 'placed') {
        // ✅ NEW: Check if user is selecting the placed cube to reposition it
        const inputType = event.inputSource.hand ? 'hand' : 'controller'
        console.log(`🔄 [DEBUG] Checking for cube interaction to start repositioning`)
        this.checkCubeInteraction(event.inputSource, event.frame, inputType)
      } else if (this.placementState === 'repositioning') {
        // ✅ NEW: Handle repositioning placement
        const inputType = event.inputSource.hand ? 'hand' : 'controller'
        console.log(`🎯 [DEBUG] Processing ${inputType} select event for repositioning`)
        this.attemptRepositioning(event.inputSource, event.frame, inputType)
      }
    }
    
    this.selectStartHandler = (event) => {
      console.log('👇 [DEBUG] Select start event:', event.inputSource.handedness)
      
      if (this.placementState === 'scanning') {
        // Store pending placement for visual feedback
        this.pendingPlacements.set(event.inputSource, {
          startTime: performance.now(),
          inputType: event.inputSource.hand ? 'hand' : 'controller'
        })
        
        // Update status to show user is interacting
        const inputType = event.inputSource.hand ? 'hand pinch' : 'controller trigger'
        this.ui.statusDiv.textContent = `🎯 ${inputType} detected - point at a surface`
      }
    }
    
    this.selectEndHandler = (event) => {
      console.log('👆 [DEBUG] Select end event:', event.inputSource.handedness)
      
      // Clean up pending placement
      this.pendingPlacements.delete(event.inputSource)
      
      if (this.placementState === 'scanning') {
        // Reset status if placement didn't succeed
        this.ui.statusDiv.textContent = 'AR Active - Looking for surfaces...'
      }
    }
    
    // Add event listeners
    this.session.addEventListener('select', this.selectHandler)
    this.session.addEventListener('selectstart', this.selectStartHandler)
    this.session.addEventListener('selectend', this.selectEndHandler)
    
    console.log('✅ [DEBUG] Input event listeners set up')
  }

  /**
   * Clean up event listeners to prevent memory leaks
   */
  cleanupEventListeners() {
    console.log('🧹 [DEBUG] Cleaning up event listeners...')
    
    if (this.session && this.selectHandler) {
      this.session.removeEventListener('select', this.selectHandler)
      this.session.removeEventListener('selectstart', this.selectStartHandler)
      this.session.removeEventListener('selectend', this.selectEndHandler)
      
      this.selectHandler = null
      this.selectStartHandler = null
      this.selectEndHandler = null
      
      console.log('✅ [DEBUG] Event listeners cleaned up')
    }
  }

  attemptPlacement(inputSource, frame, inputType) {
    if (!this.availablePlanes || this.availablePlanes.length === 0) {
      console.warn('⚠️ [DEBUG] No surfaces available for placement')
      
      // Update status to guide user
      this.ui.statusDiv.textContent = '🔍 Looking for surfaces... Look around tables, floor, or countertops'
      return
    }

    console.log(`🎯 [DEBUG] Attempting placement with ${inputType}...`)

    try {
      // ✅ ENHANCED: Try hit-testing first for precise placement
      let placementSuccessful = false
      
      if (this.hitTestManager && this.hitTestManager.isHitTestSupported()) {
        const hitResult = this.hitTestManager.getHitTestResult(inputSource)
        
        if (hitResult) {
          console.log(`🎯 [DEBUG] Using hit-test result for ${inputType} placement`)
          placementSuccessful = this.placeCubeAtHitTest(hitResult, frame)
        }
      }
      
      // ✅ FALLBACK: Use existing plane detection if hit-testing failed or unavailable
      if (!placementSuccessful) {
        console.log(`🔄 [DEBUG] Falling back to plane detection for ${inputType} placement`)
        
        // Get the pose of the input source (where user is pointing)
        const inputPose = frame.getPose(inputSource.targetRaySpace, this.refSpace)
        
        if (!inputPose) {
          console.warn('⚠️ [DEBUG] Could not get input pose')
          return
        }

        // Find the closest plane to where user is pointing
        const targetPlane = this.findClosestPlane(inputPose.transform.position, frame)
        
        if (targetPlane) {
          console.log(`🎉 [DEBUG] Found target plane for ${inputType} placement!`)
          placementSuccessful = this.placeCubeOnPlane(targetPlane, frame)
        } else {
          console.log('ℹ️ [DEBUG] No suitable plane found near pointing direction')
        }
      }
      
      if (placementSuccessful) {
        this.placementState = 'placed'
        
        // ✅ NEW: Hide cursors when placement is successful
        if (this.cursorManager) {
          this.cursorManager.hideAllCursors()
        }
        
        // ✅ NEW: Hide plane highlights when placement is successful
        if (this.planeVisualizer) {
          this.planeVisualizer.clearAllHighlights()
        }
        
        // Update status with success
        const method = this.hitTestManager?.isHitTestSupported() ? 'hit-testing' : 'plane detection'
        this.ui.statusDiv.textContent = `✅ Cube placed using ${inputType} (${method})! Point at cube to move it`
        
        console.log(`🎊 [DEBUG] Cube placed successfully using ${inputType} with ${method}!`)
      } else {
        // Guide user to point at surfaces
        this.ui.statusDiv.textContent = `👉 Point at a flat surface and ${inputType === 'hand' ? 'pinch' : 'pull trigger'}`
      }
      
    } catch (error) {
      console.error(`❌ [DEBUG] Error with ${inputType} placement:`, error)
    }
  }

  // ✅ NEW: Setup scene organization groups
  setupSceneGroups() {
    console.log('🏗️ [DEBUG] Setting up scene organization groups...')
    
    // ✅ FIXED: Create actual Three.js Groups for visual objects
    this.sceneGroups.cursors = new THREE.Group()
    this.sceneGroups.cursors.name = 'CursorsGroup'
    
    this.sceneGroups.planeVisuals = new THREE.Group()
    this.sceneGroups.planeVisuals.name = 'PlaneVisualsGroup'
    
    this.sceneGroups.content = new THREE.Group()
    this.sceneGroups.content.name = 'ContentGroup'
    
    // Add scene groups to scene
    this.scene.add(this.sceneGroups.cursors)
    this.scene.add(this.sceneGroups.planeVisuals)
    this.scene.add(this.sceneGroups.content)
    
    console.log('✅ [DEBUG] Scene organization groups set up with Three.js Groups')
  }

  // ✅ NEW: Track active input sources for cursor management
  updateInputSources(frame) {
    if (!frame.session.inputSources) return

    // Track new and existing input sources
    const currentSources = new Set()
    const newSources = []
    
    for (const inputSource of frame.session.inputSources) {
      currentSources.add(inputSource)
      
      if (!this.activeInputSources.has(inputSource)) {
        // New input source detected
        this.activeInputSources.set(inputSource, {
          type: inputSource.hand ? 'hand' : 'controller',
          handedness: inputSource.handedness,
          firstSeen: performance.now()
        })
        
        newSources.push(inputSource)
        
        console.log(`🎮 [DEBUG] New input source detected:`, {
          type: inputSource.hand ? 'hand' : 'controller',
          handedness: inputSource.handedness,
          profiles: inputSource.profiles
        })
      }
    }
    
    // Setup hit-test sources for new input sources
    if (newSources.length > 0 && this.hitTestManager) {
      // ✅ FIXED: Prevent race conditions with concurrent async setup
      if (!this.hitTestSetupInProgress) {
        this.hitTestSetupInProgress = true
        
        // Filter out sources already being set up
        const sourcesToSetup = newSources.filter(source => !this.pendingHitTestSources.has(source))
        
        if (sourcesToSetup.length > 0) {
          // Mark sources as pending setup
          sourcesToSetup.forEach(source => this.pendingHitTestSources.add(source))
          
          this.hitTestManager.setupHitTestSources(sourcesToSetup).then(() => {
            console.log(`✅ [DEBUG] Hit-test sources set up for ${sourcesToSetup.length} new input sources`)
            
            // Clear pending sources
            sourcesToSetup.forEach(source => this.pendingHitTestSources.delete(source))
            this.hitTestSetupInProgress = false
            
          }).catch(error => {
            console.warn('⚠️ [DEBUG] Failed to setup hit-test sources:', error)
            
            // Clear pending sources even on error
            sourcesToSetup.forEach(source => this.pendingHitTestSources.delete(source))
            this.hitTestSetupInProgress = false
          })
        } else {
          this.hitTestSetupInProgress = false
        }
      } else {
        console.log('⏳ [DEBUG] Hit-test setup already in progress, skipping...')
      }
    }
    
    // Remove input sources that are no longer active
    for (const [inputSource, metadata] of this.activeInputSources) {
      if (!currentSources.has(inputSource)) {
        console.log(`🎮 [DEBUG] Input source removed:`, metadata.type)
        this.activeInputSources.delete(inputSource)
        
        // ✅ FIXED: Remove obsolete cursor cleanup (cursor manager handles this now)
        this.pendingPlacements.delete(inputSource)
        
        // ✅ FIXED: Clear hit-test setup tracking for removed sources
        this.pendingHitTestSources.delete(inputSource)
      }
    }
    
    // Clean up hit-test sources for removed input sources
    if (this.hitTestManager) {
      this.hitTestManager.cleanupInactiveSources(currentSources)
    }
    
    // ✅ NEW: Clean up cursors for removed input sources
    if (this.cursorManager) {
      this.cursorManager.cleanupInactiveCursors(currentSources)
    }
  }

  /**
   * ✅ FIXED: Check if user is pointing AT the placed cube to start repositioning
   * @param {XRInputSource} inputSource Input source used for interaction
   * @param {XRFrame} frame Current XR frame
   * @param {string} inputType Type of input (hand/controller)
   */
  checkCubeInteraction(inputSource, frame, inputType) {
    if (!this.cube || !this.cube.visible) {
      console.warn('⚠️ [DEBUG] No cube available for interaction')
      return
    }

    try {
      // Get the input source pose (where user is pointing)
      const inputPose = frame.getPose(inputSource.targetRaySpace, this.refSpace)
      if (!inputPose) {
        console.warn('⚠️ [DEBUG] Could not get input pose for cube interaction')
        return
      }

      // ✅ FIXED: Create ray from input source for proper intersection test
      const rayOrigin = new THREE.Vector3(
        inputPose.transform.position.x,
        inputPose.transform.position.y,
        inputPose.transform.position.z
      )
      
      // Extract direction from orientation (forward is negative Z in WebXR)
      const orientation = inputPose.transform.orientation
      const forwardDirection = new THREE.Vector3(0, 0, -1)
      const quaternion = new THREE.Quaternion(orientation.x, orientation.y, orientation.z, orientation.w)
      forwardDirection.applyQuaternion(quaternion).normalize()
      
      // Create Three.js raycaster for accurate intersection
      const raycaster = new THREE.Raycaster(rayOrigin, forwardDirection)
      
      // ✅ FIXED: Test ray intersection with cube instead of distance
      const intersections = raycaster.intersectObject(this.cube, false)
      
      if (intersections.length > 0) {
        const intersection = intersections[0]
        const distance = intersection.distance
        
        console.log(`🎯 [DEBUG] Ray intersects cube at ${distance.toFixed(3)}m`)
        
        // Check if intersection is within reasonable range
        const MAX_INTERACTION_DISTANCE = 3.0 // 3 meters max range
        
        if (distance <= MAX_INTERACTION_DISTANCE) {
          console.log(`🔄 [DEBUG] Starting cube repositioning with ${inputType}`)
          this.startRepositioning()
        } else {
          console.log(`ℹ️ [DEBUG] Cube too far to interact (${distance.toFixed(2)}m away)`)
          this.ui.statusDiv.textContent = `📦 Cube too far to move (${distance.toFixed(1)}m away)`
        }
      } else {
        // ✅ FIXED: Provide accurate feedback when not pointing at cube
        console.log(`ℹ️ [DEBUG] Not pointing directly at the cube`)
        this.ui.statusDiv.textContent = `📦 Point directly at the cube to move it`
      }

    } catch (error) {
      console.error('❌ [DEBUG] Error checking cube interaction:', error)
    }
  }

  /**
   * ✅ NEW: Start repositioning mode
   */
  startRepositioning() {
    console.log('🔄 [DEBUG] Entering repositioning mode...')
    
    // Change state to repositioning
    this.placementState = 'repositioning'
    this.isPlaced = false // Temporarily mark as not placed
    
    // ✅ NEW: Clear anchor state for repositioning
    if (this.cubeAnchor) {
      console.log('🔗 [DEBUG] Clearing cube anchor for repositioning')
      this.cubeAnchor = null
      this.trackAnchoredCube = false
    }
    
    // Make cube semi-transparent to indicate it's being moved
    if (this.cube && this.cube.material) {
      this.cube.material.transparent = true
      this.cube.material.opacity = 0.7
      console.log('👻 [DEBUG] Made cube semi-transparent for repositioning')
    }
    
    // Update UI to guide user
    this.ui.statusDiv.textContent = '🎯 Point at a new surface and select to place cube'
    
    console.log('✅ [DEBUG] Repositioning mode activated - cursors and highlighting will reappear')
  }

  /**
   * ✅ NEW: Attempt to reposition the cube
   * @param {XRInputSource} inputSource Input source for repositioning
   * @param {XRFrame} frame Current XR frame
   * @param {string} inputType Type of input (hand/controller)
   */
  attemptRepositioning(inputSource, frame, inputType) {
    console.log(`🎯 [DEBUG] Attempting cube repositioning with ${inputType}...`)
    
    if (!this.availablePlanes || this.availablePlanes.length === 0) {
      console.warn('⚠️ [DEBUG] No surfaces available for repositioning')
      this.ui.statusDiv.textContent = '🔍 Looking for surfaces... Look around tables, floor, or countertops'
      return
    }

    try {
      // ✅ REUSE: Use existing placement logic for repositioning
      let repositionSuccessful = false
      
      if (this.hitTestManager && this.hitTestManager.isHitTestSupported()) {
        const hitResult = this.hitTestManager.getHitTestResult(inputSource)
        
        if (hitResult) {
          console.log(`🎯 [DEBUG] Using hit-test result for ${inputType} repositioning`)
          repositionSuccessful = this.placeCubeAtHitTest(hitResult, frame)
        }
      }
      
      // ✅ FALLBACK: Use existing plane detection if hit-testing failed
      if (!repositionSuccessful) {
        console.log(`🔄 [DEBUG] Falling back to plane detection for ${inputType} repositioning`)
        
        const inputPose = frame.getPose(inputSource.targetRaySpace, this.refSpace)
        if (!inputPose) {
          console.warn('⚠️ [DEBUG] Could not get input pose for repositioning')
          return
        }

        const targetPlane = this.findClosestPlane(inputPose.transform.position, frame)
        
        if (targetPlane) {
          console.log(`🎉 [DEBUG] Found target plane for ${inputType} repositioning!`)
          repositionSuccessful = this.placeCubeOnPlane(targetPlane, frame)
        } else {
          console.log('ℹ️ [DEBUG] No suitable plane found near pointing direction for repositioning')
        }
      }
      
      if (repositionSuccessful) {
        this.finishRepositioning(inputType)
      } else {
        // Guide user to point at surfaces
        this.ui.statusDiv.textContent = `👉 Point at a flat surface and ${inputType === 'hand' ? 'pinch' : 'pull trigger'}`
      }
      
    } catch (error) {
      console.error(`❌ [DEBUG] Error with ${inputType} repositioning:`, error)
    }
  }

  /**
   * ✅ NEW: Finish repositioning and return to placed state
   * @param {string} inputType Type of input used for repositioning
   */
  finishRepositioning(inputType) {
    console.log(`🎊 [DEBUG] Cube repositioned successfully using ${inputType}!`)
    
    // Return to placed state
    this.placementState = 'placed'
    this.isPlaced = true
    
    // Restore cube to full opacity
    if (this.cube && this.cube.material) {
      this.cube.material.transparent = false
      this.cube.material.opacity = 1.0
      console.log('✨ [DEBUG] Restored cube to full opacity')
    }
    
    // Hide visual feedback systems
    if (this.cursorManager) {
      this.cursorManager.hideAllCursors()
    }
    if (this.planeVisualizer) {
      this.planeVisualizer.clearAllHighlights()
    }
    
    // Update UI with success and repositioning hint
    const method = this.hitTestManager?.isHitTestSupported() ? 'hit-testing' : 'plane detection'
    this.ui.statusDiv.textContent = `✅ Cube repositioned using ${inputType} (${method})! Point at cube to move again`
    
    console.log(`🎊 [DEBUG] Repositioning complete - cube ready for next interaction`)
  }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 [DEBUG] DOM loaded, creating WebXRPlaneDetectionApp...')
  new WebXRPlaneDetectionApp()
})
