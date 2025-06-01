/**
 * WebXR Plane Detection Logic
 * Handles real-time plane detection and processing for Meta Quest 3
 */
export class PlaneDetection {
  constructor() {
    console.log('🎯 [DEBUG] PlaneDetection constructor')
    this.detectedPlanes = new Map()
    this.onPlaneDetected = null
    this.onPlaneUpdated = null
    this.onPlaneRemoved = null
    
    // Debug statistics
    this.stats = {
      totalPlanesDetected: 0,
      horizontalPlanes: 0,
      verticalPlanes: 0,
      filteredCount: 0,
      lastUpdateTime: 0
    }
    
    console.log('📊 [DEBUG] PlaneDetection stats initialized:', this.stats)

    this.planes = new Set()
    this.lastDetectedPlanesCount = 0
    this.detectionStatistics = {
      totalDetected: 0,
      horizontalCount: 0,
      verticalCount: 0,
      largestPlaneArea: 0
    }
  }

  /**
   * Check for newer WebXR geometry features
   * @param {XRSession} session
   */
  checkGeometryFeatureSupport(session) {
    console.log('🔍 [DEBUG] Checking for advanced WebXR geometry features...')
    
    // Check for mesh detection (newer Quest 3 feature)
    const hasMeshDetection = session.enabledFeatures?.includes('mesh-detection')
    console.log(`🕸️ [DEBUG] Mesh detection available: ${hasMeshDetection}`)
    
    // Check for hit-test feature
    const hasHitTest = session.enabledFeatures?.includes('hit-test')
    console.log(`🎯 [DEBUG] Hit-test available: ${hasHitTest}`)
    
    // Check for anchors support
    const hasAnchors = session.enabledFeatures?.includes('anchors')
    console.log(`⚓ [DEBUG] Anchors available: ${hasAnchors}`)
    
    // Log available features for debugging
    if (session.enabledFeatures) {
      console.log('📋 [DEBUG] All enabled features:', session.enabledFeatures)
    }
    
    return {
      meshDetection: hasMeshDetection,
      hitTest: hasHitTest,
      anchors: hasAnchors
    }
  }

  /**
   * Process detected planes from XR frame
   * @param {XRFrame} frame Current XR frame
   * @param {XRReferenceSpace} refSpace Reference space
   */
  processFrame(frame, refSpace) {
    console.log('🔍 [DEBUG] PlaneDetection.processFrame() called')
    
    if (!frame.detectedPlanes) {
      console.log('⚠️ [DEBUG] No detectedPlanes property in frame')
      return []
    }

    const currentTime = performance.now()
    const currentPlanes = []
    const newPlanes = []
    const updatedPlanes = []
    
    console.log(`📊 [DEBUG] Processing ${frame.detectedPlanes.length} detected planes`)
    
    // Update statistics
    this.stats.totalPlanesDetected = Math.max(this.stats.totalPlanesDetected, frame.detectedPlanes.length)
    this.stats.lastUpdateTime = currentTime
    
    if (frame.detectedPlanes.length === 0) {
      console.log('ℹ️ [DEBUG] No planes detected in this frame')
      return []
    }

    // Process each detected plane
    for (const plane of frame.detectedPlanes) {
      const planeData = this.analyzePlane(plane, frame, refSpace)
      if (!planeData) continue

      currentPlanes.push(planeData)

      // Check if this is a new plane or updated existing one
      if (this.detectedPlanes.has(plane)) {
        const existing = this.detectedPlanes.get(plane)
        if (this.hasPlaneChanged(existing, planeData)) {
          updatedPlanes.push(planeData)
          this.onPlaneUpdated?.(planeData, existing)
        }
      } else {
        newPlanes.push(planeData)
        this.onPlaneDetected?.(planeData)
      }

      // Update our tracking
      this.detectedPlanes.set(plane, planeData)
    }

    // Check for removed planes
    for (const [plane, planeData] of this.detectedPlanes) {
      if (!frame.detectedPlanes.has(plane)) {
        this.detectedPlanes.delete(plane)
        this.onPlaneRemoved?.(planeData)
      }
    }

    // Update statistics
    this.stats.filteredCount = currentPlanes.length
    
    console.log('📊 [DEBUG] Current plane statistics:', this.stats)
    console.log(`✅ [DEBUG] Returning ${currentPlanes.length} filtered planes`)
    
    return {
      all: currentPlanes,
      new: newPlanes,
      updated: updatedPlanes,
      horizontal: currentPlanes.filter(p => p.orientation === 'horizontal'),
      vertical: currentPlanes.filter(p => p.orientation === 'vertical')
    }
  }

  /**
   * Analyze a single plane and extract useful information
   * @param {XRPlane} plane XR plane object
   * @param {XRFrame} frame Current XR frame
   * @param {XRReferenceSpace} refSpace Reference space
   * @returns {Object|null} Analyzed plane data
   */
  analyzePlane(plane, frame, refSpace) {
    console.log('🧱 [DEBUG] Analyzing plane...')
    try {
      // Get the pose of the plane in our reference space
      const planePose = frame.getPose(plane.planeSpace, refSpace)
      if (!planePose) return null

      // Calculate plane properties
      const polygon = Array.from(plane.polygon)
      const center = this.calculateCenter(polygon)
      const dimensions = this.calculateDimensions(polygon)
      const area = this.calculateArea(polygon)

      return {
        plane,
        orientation: plane.orientation,
        pose: planePose,
        polygon,
        center,
        dimensions,
        area,
        lastChangedTime: plane.lastChangedTime,
        semanticLabel: plane.semanticLabel || 'unknown',
        // Transform center to world coordinates
        worldCenter: this.transformToWorldSpace(center, planePose.transform.matrix)
      }
    } catch (error) {
      console.error('Error analyzing plane:', error)
      return null
    }
  }

  /**
   * Calculate the center point of a polygon
   * @param {Array} polygon Array of DOMPointReadOnly
   * @returns {Object} Center coordinates {x, y, z}
   */
  calculateCenter(polygon) {
    if (!polygon || polygon.length === 0) {
      return { x: 0, y: 0, z: 0 }
    }

    let x = 0, y = 0, z = 0
    for (const point of polygon) {
      x += point.x
      y += point.y
      z += point.z
    }

    const count = polygon.length
    return {
      x: x / count,
      y: y / count,
      z: z / count
    }
  }

  /**
   * Calculate dimensions of a plane polygon
   * @param {Array} polygon Array of DOMPointReadOnly
   * @returns {Object} Dimensions {width, height, depth}
   */
  calculateDimensions(polygon) {
    if (!polygon || polygon.length < 3) {
      return { width: 0, height: 0, depth: 0 }
    }

    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (const point of polygon) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    }

    return {
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ
    }
  }

  /**
   * Calculate approximate area of a polygon using shoelace formula
   * @param {Array} polygon Array of DOMPointReadOnly
   * @returns {number} Area in square meters
   */
  calculateArea(polygon) {
    if (!polygon || polygon.length < 3) return 0

    let area = 0
    const n = polygon.length

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      area += polygon[i].x * polygon[j].z
      area -= polygon[j].x * polygon[i].z
    }

    return Math.abs(area) / 2
  }

  /**
   * Transform local coordinates to world space
   * @param {Object} localPoint Local coordinates {x, y, z}
   * @param {Float32Array} transformMatrix 4x4 transform matrix
   * @returns {Object} World coordinates {x, y, z}
   */
  transformToWorldSpace(localPoint, transformMatrix) {
    const localVec = new Float32Array([localPoint.x, localPoint.y, localPoint.z, 1.0])
    const worldVec = new Float32Array(4)

    // Matrix multiplication
    for (let i = 0; i < 4; i++) {
      worldVec[i] = 
        transformMatrix[i * 4 + 0] * localVec[0] +
        transformMatrix[i * 4 + 1] * localVec[1] +
        transformMatrix[i * 4 + 2] * localVec[2] +
        transformMatrix[i * 4 + 3] * localVec[3]
    }

    // Convert from homogeneous coordinates
    return {
      x: worldVec[0] / worldVec[3],
      y: worldVec[1] / worldVec[3],
      z: worldVec[2] / worldVec[3]
    }
  }

  /**
   * Check if plane has changed significantly
   * @param {Object} oldPlane Previous plane data
   * @param {Object} newPlane New plane data
   * @returns {boolean} True if plane has changed
   */
  hasPlaneChanged(oldPlane, newPlane) {
    const threshold = 0.01 // 1cm threshold

    return (
      newPlane.lastChangedTime !== oldPlane.lastChangedTime ||
      Math.abs(newPlane.area - oldPlane.area) > threshold ||
      Math.abs(newPlane.worldCenter.x - oldPlane.worldCenter.x) > threshold ||
      Math.abs(newPlane.worldCenter.y - oldPlane.worldCenter.y) > threshold ||
      Math.abs(newPlane.worldCenter.z - oldPlane.worldCenter.z) > threshold
    )
  }

  /**
   * Filter planes by criteria
   * @param {Array} planes Array of plane data
   * @param {Object} criteria Filtering criteria
   * @returns {Array} Filtered planes
   */
  filterPlanes(planes, criteria = {}) {
    console.log('🔽 [DEBUG] PlaneDetection.filterPlanes() starting...')
    console.log(`📝 [DEBUG] Input: ${planes.length} planes to filter`)
    
    const filtered = planes.filter(plane => {
      console.log(`🔍 [DEBUG] Evaluating plane...`)
      
      // Filter by orientation
      if (criteria.orientation && plane.orientation !== criteria.orientation) {
        console.log(`❌ [DEBUG] Plane rejected: orientation mismatch`)
        return false
      }

      // Filter by minimum area
      if (criteria.minArea && plane.area < criteria.minArea) {
        console.log(`❌ [DEBUG] Plane rejected: area too small`)
        return false
      }

      // Filter by semantic label
      if (criteria.semanticLabel && plane.semanticLabel !== criteria.semanticLabel) {
        console.log(`❌ [DEBUG] Plane rejected: semantic label mismatch`)
        return false
      }

      // Filter by height (for tables vs floors)
      if (criteria.minHeight && plane.worldCenter.y < criteria.minHeight) {
        console.log(`❌ [DEBUG] Plane rejected: height too low`)
        return false
      }

      if (criteria.maxHeight && plane.worldCenter.y > criteria.maxHeight) {
        console.log(`❌ [DEBUG] Plane rejected: height too high`)
        return false
      }

      console.log(`✅ [DEBUG] Plane passed all filters`)
      return true
    })

    console.log(`📊 [DEBUG] Filtering complete: ${filtered.length}/${planes.length} planes passed`)
    
    // Log details about accepted planes
    filtered.forEach((plane, index) => {
      console.log(`🎯 [DEBUG] Accepted plane ${index}:`, {
        orientation: plane.orientation,
        area: plane.area.toFixed(4) + ' m²'
      })
    })

    return filtered
  }

  /**
   * Find the best plane for object placement
   * @param {Array} planes Available planes
   * @param {Object} preferences Placement preferences
   * @returns {Object|null} Best plane for placement
   */
  findBestPlacementPlane(planes, preferences = {}) {
    if (!planes || planes.length === 0) return null

    // Default preferences for Meta Quest 3
    const defaultPrefs = {
      orientation: 'horizontal',
      minArea: 0.1, // 10cm x 10cm minimum
      preferredHeight: 0.7, // Table height ~70cm
      heightTolerance: 0.3 // ±30cm
    }

    const prefs = { ...defaultPrefs, ...preferences }
    
    // Filter suitable planes
    let candidates = this.filterPlanes(planes, {
      orientation: prefs.orientation,
      minArea: prefs.minArea
    })

    if (candidates.length === 0) return null

    // Score planes based on preferences
    candidates = candidates.map(plane => ({
      ...plane,
      score: this.scorePlane(plane, prefs)
    }))

    // Sort by score (higher is better)
    candidates.sort((a, b) => b.score - a.score)

    return candidates[0]
  }

  /**
   * Score a plane for placement suitability
   * @param {Object} plane Plane data
   * @param {Object} preferences Scoring preferences
   * @returns {number} Plane score (0-100)
   */
  scorePlane(plane, preferences) {
    let score = 0

    // Area score (larger is better, up to a point)
    const areaScore = Math.min(plane.area * 10, 30) // Max 30 points for area
    score += areaScore

    // Height score (closer to preferred height is better)
    const heightDiff = Math.abs(plane.worldCenter.y - preferences.preferredHeight)
    const heightScore = Math.max(0, 30 - (heightDiff / preferences.heightTolerance) * 30)
    score += heightScore

    // Stability score (planes that change less are better)
    const stabilityScore = 20 // Base stability score
    score += stabilityScore

    // Accessibility score (closer to user is often better)
    const distance = Math.sqrt(
      plane.worldCenter.x ** 2 + 
      plane.worldCenter.z ** 2
    )
    const accessibilityScore = Math.max(0, 20 - distance * 5) // Closer is better
    score += accessibilityScore

    return Math.min(score, 100)
  }

  /**
   * Set up event callbacks
   * @param {Object} callbacks Event callback functions
   */
  setEventCallbacks(callbacks) {
    this.onPlaneDetected = callbacks.onPlaneDetected
    this.onPlaneUpdated = callbacks.onPlaneUpdated
    this.onPlaneRemoved = callbacks.onPlaneRemoved
  }

  /**
   * Clear all tracked planes
   */
  clearPlanes() {
    this.detectedPlanes.clear()
  }

  /**
   * Get current plane count
   * @returns {number} Number of currently tracked planes
   */
  getPlaneCount() {
    return this.detectedPlanes.size
  }

  /**
   * Check if plane detection is currently enabled
   * @returns {boolean}
   */
  isPlaneDetectionEnabled() {
    console.log('🔍 [DEBUG] Checking if plane detection is enabled:', this.isEnabled)
    return this.isEnabled
  }

  /**
   * Enable or disable plane detection
   * @param {boolean} enabled
   */
  setPlaneDetectionEnabled(enabled) {
    console.log(`🔧 [DEBUG] Setting plane detection enabled: ${enabled}`)
    const wasEnabled = this.isEnabled
    this.isEnabled = enabled
    
    if (wasEnabled !== enabled) {
      console.log(`📢 [DEBUG] Plane detection state changed: ${wasEnabled} → ${enabled}`)
      if (!enabled) {
        console.log('🛑 [DEBUG] Plane detection disabled - conserving resources')
      } else {
        console.log('🚀 [DEBUG] Plane detection enabled - resuming plane tracking')
      }
    }
  }

  /**
   * Get current detection statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const currentStats = { ...this.stats }
    console.log('📊 [DEBUG] Current plane detection statistics:', currentStats)
    return currentStats
  }

  /**
   * Reset detection statistics
   */
  resetStats() {
    console.log('🔄 [DEBUG] Resetting plane detection statistics')
    this.stats = {
      totalPlanesDetected: 0,
      horizontalPlanes: 0,
      verticalPlanes: 0,
      filteredCount: 0,
      lastUpdateTime: 0
    }
    console.log('✅ [DEBUG] Statistics reset complete')
  }

  /**
   * Process detected planes from WebXR frame
   * @param {XRFrame} frame
   * @param {XRReferenceSpace} referenceSpace
   * @returns {Array} Array of detected plane data
   */
  processDetectedPlanes(frame, referenceSpace) {
    console.log('🔍 [DEBUG] PlaneDetection.processDetectedPlanes() called')
    
    // Check if frame has detectedPlanes
    if (!frame.detectedPlanes) {
      console.log('⚠️ [DEBUG] No detectedPlanes property on frame')
      console.log('📊 [DEBUG] Frame properties:', Object.getOwnPropertyNames(frame))
      
      // Check session for feature support
      if (frame.session) {
        this.checkGeometryFeatureSupport(frame.session)
      }
      
      return []
    }

    console.log(`🎯 [DEBUG] Frame has detectedPlanes: ${frame.detectedPlanes.size} planes`)
    
    if (frame.detectedPlanes.size === 0) {
      console.log('📊 [DEBUG] No planes detected in this frame')
      return []
    }

    const detectedPlanes = []
    
    frame.detectedPlanes.forEach((plane, index) => {
      console.log(`🛩️ [DEBUG] Processing plane ${index}:`, plane)
      
      try {
        // Get plane pose in reference space
        const planePose = frame.getPose(plane.planeSpace, referenceSpace)
        
        if (!planePose) {
          console.warn(`⚠️ [DEBUG] Could not get pose for plane ${index}`)
          return
        }

        // Analyze plane properties
        const planeData = this.analyzePlane(plane, planePose, index)
        if (planeData) {
          detectedPlanes.push(planeData)
          this.updateDetectionStatistics(planeData)
        }
        
      } catch (error) {
        console.error(`❌ [DEBUG] Error processing plane ${index}:`, error)
      }
    })

    // Update statistics
    this.lastDetectedPlanesCount = detectedPlanes.length
    console.log(`📊 [DEBUG] Successfully processed ${detectedPlanes.length} planes`)
    console.log('📊 [DEBUG] Detection statistics:', this.detectionStatistics)
    
    return detectedPlanes
  }

  /**
   * Update detection statistics
   * @param {Object} planeData Analyzed plane data
   */
  updateDetectionStatistics(planeData) {
    this.detectionStatistics.totalDetected += 1
    if (planeData.orientation === 'horizontal') {
      this.detectionStatistics.horizontalCount += 1
    } else if (planeData.orientation === 'vertical') {
      this.detectionStatistics.verticalCount += 1
    }
    this.detectionStatistics.largestPlaneArea = Math.max(this.detectionStatistics.largestPlaneArea, planeData.area)
  }
} 