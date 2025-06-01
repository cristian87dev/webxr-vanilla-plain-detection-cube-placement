/**
 * CursorManager
 * Handles visual cursor display for WebXR placement targeting
 */
import * as THREE from 'three'

export class CursorManager {
  constructor(scene, camera, sceneGroups = null) {
    console.log('🎨 [DEBUG] CursorManager constructor')
    
    this.scene = scene
    this.camera = camera
    this.cursors = new Map() // inputSource -> cursor object
    this.isDisposed = false
    
    // Cursor configuration
    this.CURSOR_SIZE = 0.2 // Match cube size
    this.CURSOR_HEIGHT = 0.02 // Thin footprint indicator
    this.CURSOR_COLOR = 0x00ffff // Cyan color for visibility
    this.CURSOR_OPACITY = 0.6
    this.ANIMATION_SPEED = 2.0 // Pulsing animation speed
    
    // ✅ FIXED: Integrate with established scene groups structure
    if (sceneGroups && sceneGroups.cursors) {
      // Use existing cursor group structure
      this.cursorGroup = sceneGroups.cursors
      console.log('🔧 [DEBUG] Using existing scene groups cursor structure')
    } else {
      // Create cursor group for organization (fallback)
      this.cursorGroup = new THREE.Group()
      this.cursorGroup.name = 'CursorGroup'
      this.scene.add(this.cursorGroup)
      console.log('🔧 [DEBUG] Created standalone cursor group')
    }
    
    console.log('✅ [DEBUG] CursorManager initialized')
  }

  /**
   * Update all cursors based on hit-test results
   * @param {Map<XRInputSource, Object>} hitTestResults Map of input sources to hit results
   * @param {number} time Current time for animations
   */
  updateCursors(hitTestResults, time) {
    if (this.isDisposed) return

    try {
      // Update existing cursors and create new ones
      for (const [inputSource, hitResult] of hitTestResults) {
        try {
          let cursor = this.cursors.get(inputSource)
          
          if (!cursor) {
            // Create new cursor for this input source
            cursor = this.createCursor(inputSource)
            this.cursors.set(inputSource, cursor)
            console.log(`🎯 [DEBUG] Created cursor for ${inputSource.handedness} ${inputSource.hand ? 'hand' : 'controller'}`)
          }
          
          // Update cursor position and visibility
          this.updateCursorPosition(cursor, hitResult, time)
          cursor.visible = true
          
        } catch (error) {
          console.warn(`⚠️ [DEBUG] Error updating cursor for ${inputSource.handedness}:`, error)
          // Hide problematic cursor
          const cursor = this.cursors.get(inputSource)
          if (cursor) cursor.visible = false
        }
      }
      
      // Hide cursors for input sources without hit results
      for (const [inputSource, cursor] of this.cursors) {
        if (!hitTestResults.has(inputSource)) {
          cursor.visible = false
        }
      }
      
    } catch (error) {
      console.error('❌ [DEBUG] Critical error in cursor updates:', error)
      // Hide all cursors on critical error
      this.hideAllCursors()
    }
  }

  /**
   * Create a visual cursor for an input source
   * @param {XRInputSource} inputSource Input source to create cursor for
   * @returns {THREE.Group} Cursor group object
   */
  createCursor(inputSource) {
    const cursorGroup = new THREE.Group()
    cursorGroup.name = `Cursor_${inputSource.handedness}_${inputSource.hand ? 'hand' : 'controller'}`
    
    // Create cube footprint outline
    const footprintGeometry = new THREE.BoxGeometry(
      this.CURSOR_SIZE, 
      this.CURSOR_HEIGHT, 
      this.CURSOR_SIZE
    )
    
    // Create wireframe material for footprint outline
    const wireframeGeometry = new THREE.EdgesGeometry(footprintGeometry)
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
      color: this.CURSOR_COLOR,
      transparent: true,
      opacity: this.CURSOR_OPACITY
    })
    const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial)
    
    // Create semi-transparent fill
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: this.CURSOR_COLOR,
      transparent: true,
      opacity: this.CURSOR_OPACITY * 0.3,
      side: THREE.DoubleSide
    })
    const fill = new THREE.Mesh(footprintGeometry, fillMaterial)
    
    // Create center indicator (small dot)
    const centerGeometry = new THREE.SphereGeometry(0.01, 8, 8)
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: this.CURSOR_COLOR,
      transparent: true,
      opacity: 0.8
    })
    const centerDot = new THREE.Mesh(centerGeometry, centerMaterial)
    centerDot.position.y = this.CURSOR_HEIGHT / 2 + 0.005 // Slightly above the footprint
    
    // Add components to cursor group
    cursorGroup.add(wireframe)
    cursorGroup.add(fill)
    cursorGroup.add(centerDot)
    
    // Store references for animation
    cursorGroup.userData = {
      wireframe,
      fill,
      centerDot,
      inputSource,
      createdAt: performance.now()
    }
    
    // Add to scene
    this.cursorGroup.add(cursorGroup)
    
    return cursorGroup
  }

  /**
   * Update cursor position and appearance
   * @param {THREE.Group} cursor Cursor object to update
   * @param {Object} hitResult Hit-test result with pose
   * @param {number} time Current time for animations
   */
  updateCursorPosition(cursor, hitResult, time) {
    const { pose } = hitResult
    
    // ✅ FIXED: Validate hit-test result before using
    if (!pose || !pose.transform || !pose.transform.position || !pose.transform.orientation) {
      console.warn('⚠️ [DEBUG] Invalid hit-test pose, skipping cursor update')
      cursor.visible = false
      return
    }
    
    const position = pose.transform.position
    const orientation = pose.transform.orientation
    
    // ✅ FIXED: Add small offset to prevent z-fighting with surfaces
    const SURFACE_OFFSET = 0.001 // 1mm above surface
    
    // Position cursor slightly above hit-test location to prevent z-fighting
    cursor.position.set(position.x, position.y + SURFACE_OFFSET, position.z)
    cursor.quaternion.set(orientation.x, orientation.y, orientation.z, orientation.w)
    
    // ✅ FIXED: Convert XR time (milliseconds) to seconds for proper animation
    const timeInSeconds = time * 0.001
    const pulseFactor = 0.8 + 0.2 * Math.sin(timeInSeconds * this.ANIMATION_SPEED)
    const { wireframe, fill, centerDot } = cursor.userData
    
    if (wireframe && wireframe.material) {
      wireframe.material.opacity = this.CURSOR_OPACITY * pulseFactor
    }
    if (fill && fill.material) {
      fill.material.opacity = this.CURSOR_OPACITY * 0.3 * pulseFactor
    }
    if (centerDot && centerDot.material) {
      centerDot.material.opacity = 0.8 * pulseFactor
    }
  }

  /**
   * Remove cursor for specific input source
   * @param {XRInputSource} inputSource Input source to remove cursor for
   */
  removeCursor(inputSource) {
    const cursor = this.cursors.get(inputSource)
    if (cursor) {
      console.log(`🧹 [DEBUG] Removing cursor for ${inputSource.handedness}`)
      
      // Remove from scene
      this.cursorGroup.remove(cursor)
      
      // Dispose of geometry and materials
      this.disposeCursorResources(cursor)
      
      // Remove from tracking
      this.cursors.delete(inputSource)
    }
  }

  /**
   * Clean up cursor resources
   * @param {THREE.Group} cursor Cursor to dispose
   */
  disposeCursorResources(cursor) {
    cursor.traverse((child) => {
      if (child.geometry) {
        child.geometry.dispose()
      }
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose())
        } else {
          child.material.dispose()
        }
      }
    })
  }

  /**
   * Hide all cursors
   */
  hideAllCursors() {
    for (const cursor of this.cursors.values()) {
      cursor.visible = false
    }
  }

  /**
   * Show all cursors
   */
  showAllCursors() {
    for (const cursor of this.cursors.values()) {
      cursor.visible = true
    }
  }

  /**
   * Clean up cursor resources for removed input sources
   * @param {Set<XRInputSource>} activeInputSources Currently active input sources
   */
  cleanupInactiveCursors(activeInputSources) {
    for (const [inputSource, cursor] of this.cursors) {
      if (!activeInputSources.has(inputSource)) {
        console.log(`🧹 [DEBUG] Cleaning up cursor for removed ${inputSource.handedness}`)
        this.removeCursor(inputSource)
      }
    }
  }

  /**
   * Get cursor for specific input source
   * @param {XRInputSource} inputSource Input source
   * @returns {THREE.Group|null} Cursor object or null
   */
  getCursor(inputSource) {
    return this.cursors.get(inputSource) || null
  }

  /**
   * Get all cursors
   * @returns {Map<XRInputSource, THREE.Group>} Map of input sources to cursors
   */
  getAllCursors() {
    return new Map(this.cursors)
  }

  /**
   * Dispose of all cursors and cleanup resources
   */
  dispose() {
    if (this.isDisposed) {
      console.log('ℹ️ [DEBUG] CursorManager already disposed')
      return
    }
    
    console.log('🧹 [DEBUG] Disposing CursorManager...')
    
    // Remove all cursors
    for (const [inputSource, cursor] of this.cursors) {
      this.disposeCursorResources(cursor)
    }
    
    // Remove cursor group from scene
    if (this.cursorGroup.parent) {
      this.cursorGroup.parent.remove(this.cursorGroup)
    }
    
    // Clear tracking
    this.cursors.clear()
    this.isDisposed = true
    
    console.log('✅ [DEBUG] CursorManager disposed')
  }

  /**
   * Get debug information about cursor state
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      isDisposed: this.isDisposed,
      activeCursors: this.cursors.size,
      cursors: Array.from(this.cursors.keys()).map(source => ({
        handedness: source.handedness,
        type: source.hand ? 'hand' : 'controller'
      }))
    }
  }
} 