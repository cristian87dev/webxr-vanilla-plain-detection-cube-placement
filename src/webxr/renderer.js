/**
 * WebXR Renderer
 * Handles Three.js integration and WebGL setup for AR visualization
 */
import * as THREE from 'three'

export class WebXRRenderer {
  constructor() {
    console.log('🎨 [DEBUG] WebXRRenderer constructor')
    this.renderer = null
    this.scene = null
    this.camera = null
    this.canvas = null
    this.gl = null
    this.session = null
    this.controller1 = null
    this.controller2 = null
    this.initialized = false
    
    console.log('✅ [DEBUG] WebXRRenderer constructor complete')
  }

  /**
   * Initialize WebXR Renderer with Three.js and WebGL setup
   * @param {XRSession} session The WebXR session
   * @returns {Promise<void>}
   */
  async initialize(session) {
    console.log('🔧 [DEBUG] WebXRRenderer.initialize() starting...')
    
    try {
      this.session = session
      console.log('📊 [DEBUG] Session provided to renderer:', !!session)
      
      // Create canvas and WebGL context
      await this.setupCanvas()
      console.log('✅ [DEBUG] Canvas and WebGL context created')
      
      // Initialize Three.js components
      this.setupThreeJS()
      console.log('✅ [DEBUG] Three.js components initialized')
      
      // Configure WebXR rendering
      this.setupWebXRRendering()
      console.log('✅ [DEBUG] WebXR rendering configured')
      
      // Setup lighting for AR
      this.setupLighting()
      console.log('✅ [DEBUG] Lighting setup complete')
      
      // Add renderer to DOM
      console.log('🌐 [DEBUG] Adding renderer to DOM...')
      document.body.appendChild(this.renderer.domElement)
      console.log('✅ [DEBUG] Renderer canvas added to DOM')

      this.initialized = true
      console.log('✅ [DEBUG] WebXRRenderer initialization complete')
      console.log('📊 [DEBUG] Renderer state:', {
        hasRenderer: !!this.renderer,
        hasScene: !!this.scene,
        hasCamera: !!this.camera,
        isXREnabled: this.renderer?.xr?.enabled
      })
      
    } catch (error) {
      console.error('❌ [DEBUG] WebXRRenderer initialization failed:', error)
      throw error
    }
  }

  /**
   * Setup canvas and WebGL context for XR
   * @returns {Promise<void>}
   */
  async setupCanvas() {
    // Create or get existing canvas
    this.canvas = document.querySelector('canvas') || document.createElement('canvas')
    if (!document.querySelector('canvas')) {
      document.body.appendChild(this.canvas)
    }

    // Get WebGL context with XR compatibility
    this.gl = this.canvas.getContext('webgl2', { 
      xrCompatible: true,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false
    }) || this.canvas.getContext('webgl', { 
      xrCompatible: true,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false
    })

    if (!this.gl) {
      throw new Error('Unable to create WebGL context')
    }

    // Make context XR compatible
    await this.gl.makeXRCompatible()
    console.log('✅ WebGL context created and made XR compatible')
  }

  /**
   * Setup Three.js components
   */
  setupThreeJS() {
    // Create Three.js renderer using existing WebGL context
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      context: this.gl,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false
    })

    // Configure renderer for XR
    this.renderer.autoClear = false
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.xr.enabled = true

    // Create scene
    this.scene = new THREE.Scene()

    // Create camera (will be managed by WebXR)
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000)

    console.log('✅ Three.js scene, renderer, and camera created')
  }

  /**
   * Configure WebXR rendering pipeline
   */
  setupWebXRRendering() {
    // Set up base layer for rendering
    this.session.updateRenderState({
      baseLayer: new XRWebGLLayer(this.session, this.gl)
    })

    // Configure Three.js for XR
    this.renderer.xr.setReferenceSpaceType('local')
    this.renderer.xr.setSession(this.session)

    console.log('✅ WebXR rendering pipeline configured')
  }

  /**
   * Setup lighting for AR scene
   */
  setupLighting() {
    console.log('💡 [DEBUG] Setting up AR lighting...')
    
    try {
      // Ambient light for general illumination
      console.log('🌕 [DEBUG] Adding ambient light...')
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
      this.scene.add(ambientLight)
      console.log('✅ [DEBUG] Ambient light added')

      // Directional light for shadows and depth
      console.log('☀️ [DEBUG] Adding directional light...')
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
      directionalLight.position.set(1, 1, 1).normalize()
      this.scene.add(directionalLight)
      console.log('✅ [DEBUG] Directional light added')

      console.log('✅ [DEBUG] Lighting setup complete')
    } catch (error) {
      console.error('❌ [DEBUG] Error setting up lighting:', error)
    }
  }

  /**
   * Create a visual representation of a detected plane
   * @param {Object} planeData Analyzed plane data
   * @returns {THREE.Object3D} Three.js object representing the plane
   */
  createPlaneVisualization(planeData) {
    const group = new THREE.Group()

    // Create plane mesh from polygon
    const planeMesh = this.createPlaneMesh(planeData.polygon)
    if (planeMesh) {
      // Semi-transparent material to show the detected surface
      const material = new THREE.MeshLambertMaterial({
        color: planeData.orientation === 'horizontal' ? 0x00ff00 : 0x0000ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
      })
      planeMesh.material = material
      group.add(planeMesh)
    }

    // Add wireframe border
    const wireframe = this.createPlaneWireframe(planeData.polygon)
    if (wireframe) {
      group.add(wireframe)
    }

    // Add center indicator
    const centerIndicator = this.createCenterIndicator()
    centerIndicator.position.set(
      planeData.center.x,
      planeData.center.y + 0.01, // Slightly above the plane
      planeData.center.z
    )
    group.add(centerIndicator)

    // Position the group according to the plane's pose
    if (planeData.pose) {
      const matrix = new THREE.Matrix4()
      matrix.fromArray(planeData.pose.transform.matrix)
      group.applyMatrix4(matrix)
    }

    return group
  }

  /**
   * Create a mesh from plane polygon
   * @param {Array} polygon Plane polygon points
   * @returns {THREE.Mesh|null} Plane mesh
   */
  createPlaneMesh(polygon) {
    if (!polygon || polygon.length < 3) return null

    try {
      // Convert polygon to Three.js geometry
      const shape = new THREE.Shape()
      
      // Move to first point
      shape.moveTo(polygon[0].x, polygon[0].z)
      
      // Draw lines to other points
      for (let i = 1; i < polygon.length; i++) {
        shape.lineTo(polygon[i].x, polygon[i].z)
      }

      // Create geometry from shape
      const geometry = new THREE.ShapeGeometry(shape)
      
      // Rotate to lie flat (XZ plane)
      geometry.rotateX(-Math.PI / 2)
      
      return new THREE.Mesh(geometry)
    } catch (error) {
      console.warn('Could not create plane mesh:', error)
      return null
    }
  }

  /**
   * Create wireframe outline for plane
   * @param {Array} polygon Plane polygon points
   * @returns {THREE.LineLoop|null} Wireframe outline
   */
  createPlaneWireframe(polygon) {
    if (!polygon || polygon.length < 3) return null

    const points = polygon.map(p => new THREE.Vector3(p.x, p.y, p.z))
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      linewidth: 2
    })

    return new THREE.LineLoop(geometry, material)
  }

  /**
   * Create a small indicator for the plane center
   * @returns {THREE.Mesh} Center indicator
   */
  createCenterIndicator() {
    const geometry = new THREE.RingGeometry(0.02, 0.04, 8)
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(geometry, material)
    ring.rotateX(-Math.PI / 2) // Lie flat
    return ring
  }

  /**
   * Create a cube object for placement on planes
   * @param {number} size Cube size in meters
   * @param {number} color Cube color (hex)
   * @returns {THREE.Mesh} Cube mesh
   */
  createCube(size = 0.2, color = 0x00ff00) {
    const geometry = new THREE.BoxGeometry(size, size, size)
    const material = new THREE.MeshNormalMaterial()
    const cube = new THREE.Mesh(geometry, material)
    
    // Enable shadows
    cube.castShadow = true
    cube.receiveShadow = true
    
    return cube
  }

  /**
   * Update renderer size for responsive design
   * @param {number} width Canvas width
   * @param {number} height Canvas height
   */
  updateSize(width, height) {
    if (this.renderer && this.camera) {
      this.renderer.setSize(width, height)
      this.camera.aspect = width / height
      this.camera.updateProjectionMatrix()
    }
  }

  /**
   * Add object to scene
   * @param {THREE.Object3D} object Three.js object to add
   */
  addToScene(object) {
    if (this.scene) {
      this.scene.add(object)
    }
  }

  /**
   * Remove object from scene
   * @param {THREE.Object3D} object Three.js object to remove
   */
  removeFromScene(object) {
    if (this.scene) {
      this.scene.remove(object)
    }
  }

  /**
   * Clear all objects from scene (except lights and camera)
   */
  clearScene() {
    if (!this.scene) return

    const objectsToRemove = []
    this.scene.traverse((child) => {
      if (child.isMesh && !child.isLight) {
        objectsToRemove.push(child)
      }
    })

    objectsToRemove.forEach(obj => this.scene.remove(obj))
  }

  /**
   * Render the scene
   * @param {THREE.Scene} scene Scene to render (optional, uses default if not provided)
   * @param {THREE.Camera} camera Camera to use (optional, uses default if not provided)
   */
  render(scene = this.scene, camera = this.camera) {
    if (this.renderer && scene && camera) {
      this.renderer.clearDepth()
      this.renderer.render(scene, camera)
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    this.updateSize(window.innerWidth, window.innerHeight)
  }

  /**
   * Dispose of renderer resources
   */
  dispose() {
    console.log('🧹 [DEBUG] WebXRRenderer.dispose() called')
    
    try {
      if (this.renderer) {
        console.log('🧹 [DEBUG] Disposing WebGL renderer...')
        this.renderer.dispose()
        
        // Remove from DOM
        if (this.renderer.domElement && this.renderer.domElement.parentNode) {
          console.log('🧹 [DEBUG] Removing renderer canvas from DOM...')
          this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
        }
        
        this.renderer = null
        console.log('✅ [DEBUG] Renderer disposed')
      }

      if (this.scene) {
        console.log('🧹 [DEBUG] Clearing scene...')
        this.scene.clear()
        this.scene = null
        console.log('✅ [DEBUG] Scene cleared')
      }

      this.camera = null
      this.controller1 = null
      this.controller2 = null
      this.initialized = false
      
      console.log('✅ [DEBUG] WebXRRenderer cleanup complete')
      
    } catch (error) {
      console.error('❌ [DEBUG] Error during renderer cleanup:', error)
    }
  }

  /**
   * Get current renderer stats
   * @returns {Object} Renderer statistics
   */
  getStats() {
    if (!this.renderer) return null

    return {
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      calls: this.renderer.info.render.calls,
      frame: this.renderer.info.render.frame
    }
  }

  /**
   * Check if renderer is initialized
   * @returns {boolean}
   */
  isInitialized() {
    console.log('🔍 [DEBUG] Checking if renderer is initialized:', this.initialized)
    return this.initialized
  }
} 