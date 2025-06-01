/**
 * PlaneVisualizer
 * Handles visual highlighting of detected planes for WebXR placement targeting
 */
import * as THREE from 'three'

export class PlaneVisualizer {
  constructor(scene, sceneGroups = null) {
    console.log('🎭 [DEBUG] PlaneVisualizer constructor')
    
    this.scene = scene
    this.planeHighlights = new Map() // plane -> highlight object
    this.currentTargetPlane = null
    this.isDisposed = false
    
    // Plane visualization configuration
    this.HIGHLIGHT_COLOR = 0x00ff00 // Green for valid target surfaces
    this.HIGHLIGHT_OPACITY = 0.2
    this.WIREFRAME_COLOR = 0x00ff88
    this.WIREFRAME_OPACITY = 0.6
    this.ANIMATION_SPEED = 1.5 // Glow animation speed
    
    // ✅ Integrate with established scene groups structure
    if (sceneGroups && sceneGroups.planeVisuals) {
      this.planeGroup = sceneGroups.planeVisuals
      console.log('🔧 [DEBUG] Using existing scene groups plane structure')
    } else {
      // Create plane group for organization (fallback)
      this.planeGroup = new THREE.Group()
      this.planeGroup.name = 'PlaneVisualsGroup'
      this.scene.add(this.planeGroup)
      console.log('🔧 [DEBUG] Created standalone plane visuals group')
    }
    
    console.log('✅ [DEBUG] PlaneVisualizer initialized')
  }

  /**
   * Update plane highlighting based on hit-test results and detected planes
   * @param {Map<XRInputSource, Object>} hitTestResults Map of input sources to hit results
   * @param {Array<XRPlane>} availablePlanes Array of detected planes
   * @param {XRFrame} frame Current XR frame for plane poses
   * @param {XRReferenceSpace} refSpace Reference space for transformations
   * @param {number} time Current time for animations
   */
  updatePlaneHighlighting(hitTestResults, availablePlanes, frame, refSpace, time) {
    if (this.isDisposed || !availablePlanes || availablePlanes.length === 0) {
      this.clearAllHighlights()
      return
    }

    try {
      // Find planes that are currently being targeted by hit-tests
      const targetedPlanes = new Set()
      
      for (const [inputSource, hitResult] of hitTestResults) {
        const targetedPlane = this.findPlaneNearHitTest(hitResult, availablePlanes, frame, refSpace)
        if (targetedPlane) {
          targetedPlanes.add(targetedPlane)
        }
      }

      // Update highlights for targeted planes
      for (const plane of targetedPlanes) {
        this.highlightPlane(plane, frame, refSpace, time)
      }

      // Remove highlights for planes no longer targeted
      for (const [plane, highlight] of this.planeHighlights) {
        if (!targetedPlanes.has(plane)) {
          this.removeHighlight(plane)
        }
      }

    } catch (error) {
      console.error('❌ [DEBUG] Error updating plane highlighting:', error)
      this.clearAllHighlights()
    }
  }

  /**
   * Find the plane closest to a hit-test result
   * @param {Object} hitResult Hit-test result with pose
   * @param {Array<XRPlane>} availablePlanes Array of detected planes
   * @param {XRFrame} frame Current XR frame
   * @param {XRReferenceSpace} refSpace Reference space for transformations
   * @returns {XRPlane|null} Closest plane or null
   */
  findPlaneNearHitTest(hitResult, availablePlanes, frame, refSpace) {
    if (!hitResult?.pose?.transform?.position) return null

    const hitPosition = hitResult.pose.transform.position
    const PROXIMITY_THRESHOLD = 0.1 // 10cm proximity threshold

    let closestPlane = null
    let closestDistance = Infinity

    for (const plane of availablePlanes) {
      try {
        const planePose = frame.getPose(plane.planeSpace, refSpace)
        if (!planePose) continue

        // Calculate distance from hit-test to plane center
        const distance = Math.sqrt(
          Math.pow(hitPosition.x - planePose.transform.position.x, 2) +
          Math.pow(hitPosition.y - planePose.transform.position.y, 2) +
          Math.pow(hitPosition.z - planePose.transform.position.z, 2)
        )

        if (distance < closestDistance && distance < PROXIMITY_THRESHOLD) {
          closestDistance = distance
          closestPlane = plane
        }
      } catch (error) {
        console.warn('⚠️ [DEBUG] Error calculating plane proximity:', error)
      }
    }

    return closestPlane
  }

  /**
   * Highlight a specific plane
   * @param {XRPlane} plane Plane to highlight
   * @param {XRFrame} frame Current XR frame
   * @param {XRReferenceSpace} refSpace Reference space for transformations
   * @param {number} time Current time for animations
   */
  highlightPlane(plane, frame, refSpace, time) {
    try {
      let highlight = this.planeHighlights.get(plane)
      
      if (!highlight) {
        // Create new highlight for this plane
        highlight = this.createPlaneHighlight(plane, frame, refSpace)
        if (highlight) {
          this.planeHighlights.set(plane, highlight)
          this.planeGroup.add(highlight)
          console.log(`🎨 [DEBUG] Created highlight for ${plane.orientation} plane`)
        }
      }

      if (highlight) {
        // Update highlight position and animation
        this.updateHighlightAnimation(highlight, time)
        highlight.visible = true
      }

    } catch (error) {
      console.warn('⚠️ [DEBUG] Error highlighting plane:', error)
    }
  }

  /**
   * Create visual highlight for a plane
   * @param {XRPlane} plane Plane to create highlight for
   * @param {XRFrame} frame Current XR frame
   * @param {XRReferenceSpace} refSpace Reference space for transformations
   * @returns {THREE.Group|null} Highlight group or null
   */
  createPlaneHighlight(plane, frame, refSpace) {
    try {
      const planePose = frame.getPose(plane.planeSpace, refSpace)
      if (!planePose || !plane.polygon) return null

      const highlightGroup = new THREE.Group()
      highlightGroup.name = `PlaneHighlight_${plane.orientation}_${performance.now()}`

      // Create plane mesh from polygon
      const planeMesh = this.createPlaneMeshFromPolygon(plane.polygon)
      if (!planeMesh) return null

      // ✅ FIXED: Store base geometry reference for proper cleanup
      const baseGeometry = planeMesh.geometry

      // Semi-transparent fill material
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: this.HIGHLIGHT_COLOR,
        transparent: true,
        opacity: this.HIGHLIGHT_OPACITY,
        side: THREE.DoubleSide,
        depthWrite: false // Prevent depth conflicts
      })
      const fill = new THREE.Mesh(baseGeometry, fillMaterial)

      // ✅ FIXED: Create separate wireframe geometry and store reference
      const wireframeGeometry = new THREE.EdgesGeometry(baseGeometry)
      const wireframeMaterial = new THREE.LineBasicMaterial({
        color: this.WIREFRAME_COLOR,
        transparent: true,
        opacity: this.WIREFRAME_OPACITY
      })
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial)

      // Add components to highlight group
      highlightGroup.add(fill)
      highlightGroup.add(wireframe)

      // Position highlight at plane pose
      const pos = planePose.transform.position
      const rot = planePose.transform.orientation
      highlightGroup.position.set(pos.x, pos.y, pos.z)
      highlightGroup.quaternion.set(rot.x, rot.y, rot.z, rot.w)

      // ✅ FIXED: Store all geometry references for proper cleanup
      highlightGroup.userData = {
        plane,
        fill,
        wireframe,
        baseGeometry,        // Store base geometry for disposal
        wireframeGeometry,   // Store wireframe geometry for disposal
        createdAt: performance.now()
      }

      return highlightGroup

    } catch (error) {
      console.error('❌ [DEBUG] Error creating plane highlight:', error)
      return null
    }
  }

  /**
   * Create a Three.js mesh from plane polygon
   * @param {Array<DOMPointReadOnly>} polygon Plane polygon vertices
   * @returns {THREE.Mesh|null} Plane mesh or null
   */
  createPlaneMeshFromPolygon(polygon) {
    try {
      if (!polygon || polygon.length < 3) return null

      // Convert polygon to Three.js vertices
      const vertices = []
      const indices = []

      // Add vertices
      for (const point of polygon) {
        vertices.push(point.x, point.y, point.z)
      }

      // ✅ FIXED: Improved triangulation for potentially non-convex polygons
      if (polygon.length === 3) {
        // Triangle - direct indices
        indices.push(0, 1, 2)
      } else if (polygon.length === 4) {
        // Quad - two triangles
        indices.push(0, 1, 2)
        indices.push(0, 2, 3)
      } else {
        // For complex polygons, use fan triangulation from first vertex
        // This works for most convex polygons and some simple non-convex ones
        for (let i = 1; i < polygon.length - 1; i++) {
          indices.push(0, i, i + 1)
        }
        
        // ✅ TODO: For robust non-convex polygon support, consider using
        // a proper triangulation library like earcut.js in future versions
        console.log(`🔺 [DEBUG] Using fan triangulation for ${polygon.length}-vertex polygon`)
      }

      // Create geometry with error handling
      const geometry = new THREE.BufferGeometry()
      
      try {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        geometry.setIndex(indices)
        geometry.computeVertexNormals()
        
        // Validate the geometry was created successfully
        if (geometry.attributes.position.count === 0) {
          console.warn('⚠️ [DEBUG] Created empty geometry from polygon')
          geometry.dispose()
          return null
        }
        
      } catch (geometryError) {
        console.error('❌ [DEBUG] Error setting up BufferGeometry:', geometryError)
        geometry.dispose()
        return null
      }

      return { geometry }

    } catch (error) {
      console.error('❌ [DEBUG] Error creating plane mesh from polygon:', error)
      return null
    }
  }

  /**
   * Update highlight animation
   * @param {THREE.Group} highlight Highlight object to animate
   * @param {number} time Current time for animations
   */
  updateHighlightAnimation(highlight, time) {
    const { fill, wireframe } = highlight.userData
    
    // Convert XR time to seconds for animation
    const timeInSeconds = time * 0.001
    const glowFactor = 0.7 + 0.3 * Math.sin(timeInSeconds * this.ANIMATION_SPEED)

    if (fill && fill.material) {
      fill.material.opacity = this.HIGHLIGHT_OPACITY * glowFactor
    }
    if (wireframe && wireframe.material) {
      wireframe.material.opacity = this.WIREFRAME_OPACITY * glowFactor
    }
  }

  /**
   * Remove highlight for specific plane
   * @param {XRPlane} plane Plane to remove highlight for
   */
  removeHighlight(plane) {
    const highlight = this.planeHighlights.get(plane)
    if (highlight) {
      console.log(`🧹 [DEBUG] Removing highlight for ${plane.orientation} plane`)
      
      // Remove from scene
      this.planeGroup.remove(highlight)
      
      // Dispose of resources
      this.disposeHighlightResources(highlight)
      
      // Remove from tracking
      this.planeHighlights.delete(plane)
    }
  }

  /**
   * Clear all plane highlights
   */
  clearAllHighlights() {
    for (const [plane, highlight] of this.planeHighlights) {
      this.planeGroup.remove(highlight)
      this.disposeHighlightResources(highlight)
    }
    this.planeHighlights.clear()
    this.currentTargetPlane = null
  }

  /**
   * Clean up highlight resources
   * @param {THREE.Group} highlight Highlight to dispose
   */
  disposeHighlightResources(highlight) {
    const { fill, wireframe, baseGeometry, wireframeGeometry } = highlight.userData
    
    // ✅ FIXED: Dispose materials with proper array handling
    if (fill && fill.material) {
      if (Array.isArray(fill.material)) {
        fill.material.forEach(material => {
          // Dispose material textures first
          this.disposeMaterialTextures(material)
          material.dispose()
        })
      } else {
        this.disposeMaterialTextures(fill.material)
        fill.material.dispose()
      }
    }
    
    if (wireframe && wireframe.material) {
      if (Array.isArray(wireframe.material)) {
        wireframe.material.forEach(material => {
          this.disposeMaterialTextures(material)
          material.dispose()
        })
      } else {
        this.disposeMaterialTextures(wireframe.material)
        wireframe.material.dispose()
      }
    }
    
    // ✅ FIXED: Properly dispose geometries with attribute cleanup
    if (baseGeometry) {
      this.disposeGeometryCompletely(baseGeometry)
    }
    if (wireframeGeometry) {
      this.disposeGeometryCompletely(wireframeGeometry)
    }
  }

  /**
   * ✅ NEW: Dispose material textures to prevent memory leaks
   * @param {THREE.Material} material Material to dispose textures from
   */
  disposeMaterialTextures(material) {
    const textureProperties = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap',
      'alphaMap', 'aoMap', 'displacementMap', 'emissiveMap', 'gradientMap',
      'metalnessMap', 'roughnessMap'
    ]
    
    textureProperties.forEach(prop => {
      if (material[prop] && typeof material[prop].dispose === 'function') {
        material[prop].dispose()
      }
    })
  }

  /**
   * ✅ NEW: Complete geometry disposal following Three.js best practices
   * @param {THREE.BufferGeometry} geometry Geometry to dispose completely
   */
  disposeGeometryCompletely(geometry) {
    if (!geometry) return
    
    try {
      // Dispose all attributes as per Three.js documentation
      if (geometry.attributes) {
        Object.values(geometry.attributes).forEach(attribute => {
          if (attribute && attribute.array) {
            // Clear the array reference to help garbage collection
            attribute.array = null
          }
        })
      }
      
      // Dispose index if it exists
      if (geometry.index && geometry.index.array) {
        geometry.index.array = null
      }
      
      // Finally dispose the geometry itself
      geometry.dispose()
      
    } catch (error) {
      console.warn('⚠️ [DEBUG] Error during complete geometry disposal:', error)
    }
  }

  /**
   * Get current highlighted planes
   * @returns {Map<XRPlane, THREE.Group>} Map of planes to highlights
   */
  getHighlightedPlanes() {
    return new Map(this.planeHighlights)
  }

  /**
   * Dispose of all highlights and cleanup resources
   */
  dispose() {
    if (this.isDisposed) {
      console.log('ℹ️ [DEBUG] PlaneVisualizer already disposed')
      return
    }
    
    console.log('🧹 [DEBUG] Disposing PlaneVisualizer...')
    
    // Remove all highlights
    this.clearAllHighlights()
    
    // Remove plane group from scene if we created it
    if (this.planeGroup.parent && this.planeGroup.name === 'PlaneVisualsGroup') {
      this.planeGroup.parent.remove(this.planeGroup)
    }
    
    this.isDisposed = true
    
    console.log('✅ [DEBUG] PlaneVisualizer disposed')
  }

  /**
   * Get debug information about plane visualization state
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      isDisposed: this.isDisposed,
      highlightedPlanes: this.planeHighlights.size,
      currentTargetPlane: this.currentTargetPlane ? this.currentTargetPlane.orientation : null
    }
  }
} 