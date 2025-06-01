/**
 * 3D Math Utilities for WebXR
 * Contains mathematical functions for plane detection and 3D transformations
 */

/**
 * Multiply a 4x4 matrix by a 4D point (homogeneous coordinates)
 * Used to transform plane local coordinates to world space
 * @param {Float32Array} matrix 4x4 transformation matrix (16 elements)
 * @param {Float32Array} point 4D point [x, y, z, w]
 * @returns {Float32Array} Transformed 4D point
 */
export function multiplyMatrixAndPoint(matrix, point) {
  console.log('🔢 [DEBUG] Matrix multiplication starting...')
  console.log('📊 [DEBUG] Input matrix (first 4 values):', Array.from(matrix.slice(0, 4)))
  console.log('📍 [DEBUG] Input point:', Array.from(point))
  
  if (matrix.length !== 16) {
    console.error('❌ [DEBUG] Invalid matrix size:', matrix.length, 'expected 16')
    throw new Error('Matrix must be 4x4 (16 elements)')
  }
  
  if (point.length !== 4) {
    console.error('❌ [DEBUG] Invalid point size:', point.length, 'expected 4')
    throw new Error('Point must be 4D [x, y, z, w]')
  }

  const result = new Float32Array(4)
  
  // Matrix multiplication: result = matrix * point
  // Column-major order: matrix[column*4 + row]
  for (let row = 0; row < 4; row++) {
    let sum = 0
    for (let col = 0; col < 4; col++) {
      const matrixValue = matrix[col * 4 + row]
      const pointValue = point[col]
      sum += matrixValue * pointValue
      
      if (row === 0) { // Only log for first row to avoid spam
        console.log(`🔢 [DEBUG] M[${col},${row}] * P[${col}] = ${matrixValue.toFixed(6)} * ${pointValue.toFixed(6)} = ${(matrixValue * pointValue).toFixed(6)}`)
      }
    }
    result[row] = sum
  }

  console.log('✅ [DEBUG] Matrix multiplication result:', Array.from(result))
  console.log('🌍 [DEBUG] Transformed coordinates:', {
    x: result[0],
    y: result[1], 
    z: result[2],
    w: result[3]
  })
  
  return result
}

/**
 * Calculate the center point of a plane polygon
 * @param {Array} polygon Array of DOMPointReadOnly objects
 * @returns {Object} Center coordinates {x, y, z}
 */
export function getPlaneCenter(polygon) {
  console.log('📐 [DEBUG] Calculating plane center...')
  console.log(`📊 [DEBUG] Input polygon has ${polygon.length} vertices`)
  
  if (!polygon || polygon.length === 0) {
    console.error('❌ [DEBUG] Empty or invalid polygon provided')
    throw new Error('Polygon cannot be empty')
  }

  if (polygon.length < 3) {
    console.warn('⚠️ [DEBUG] Polygon has less than 3 vertices, may not be valid')
  }

  let sumX = 0, sumY = 0, sumZ = 0
  
  // Log each vertex for debugging
  polygon.forEach((point, index) => {
    console.log(`📍 [DEBUG] Vertex ${index}: (${point.x.toFixed(6)}, ${point.y.toFixed(6)}, ${point.z.toFixed(6)})`)
    sumX += point.x
    sumY += point.y
    sumZ += point.z
  })

  const count = polygon.length
  const centroid = {
    x: sumX / count,
    y: sumY / count,
    z: sumZ / count
  }

  console.log('📊 [DEBUG] Sum coordinates:', { sumX, sumY, sumZ })
  console.log('📊 [DEBUG] Vertex count:', count)
  console.log('✅ [DEBUG] Calculated centroid:', centroid)
  
  return centroid
}

/**
 * Calculate distance between two 3D points
 * @param {Object} point1 First point {x, y, z}
 * @param {Object} point2 Second point {x, y, z}
 * @returns {number} Distance between points
 */
export function distance3D(point1, point2) {
  console.log('📏 [DEBUG] Calculating 3D distance...')
  console.log('📍 [DEBUG] Point 1:', point1)
  console.log('📍 [DEBUG] Point 2:', point2)
  
  const dx = point2.x - point1.x
  const dy = point2.y - point1.y
  const dz = point2.z - point1.z
  
  console.log('📊 [DEBUG] Delta values:', { dx, dy, dz })
  
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz)
  
  console.log('✅ [DEBUG] Calculated distance:', distance)
  
  return distance
}

/**
 * Normalize a 3D vector
 * @param {Object} vector Vector {x, y, z}
 * @returns {Object} Normalized vector {x, y, z}
 */
export function normalize3D(vector) {
  console.log('🧭 [DEBUG] Normalizing 3D vector...')
  console.log('📍 [DEBUG] Input vector:', vector)
  
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)
  
  console.log('📏 [DEBUG] Vector length:', length)
  
  if (length === 0) {
    console.warn('⚠️ [DEBUG] Cannot normalize zero-length vector')
    return { x: 0, y: 0, z: 0 }
  }

  const normalized = {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  }
  
  console.log('✅ [DEBUG] Normalized vector:', normalized)
  
  return normalized
}

/**
 * Calculate cross product of two 3D vectors
 * @param {Object} a First vector {x, y, z}
 * @param {Object} b Second vector {x, y, z}
 * @returns {Object} Cross product vector {x, y, z}
 */
export function crossProduct3D(a, b) {
  console.log('✖️ [DEBUG] Calculating cross product...')
  console.log('📍 [DEBUG] Vector A:', a)
  console.log('📍 [DEBUG] Vector B:', b)
  
  const result = {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  }
  
  console.log('✅ [DEBUG] Cross product result:', result)
  
  return result
}

/**
 * Calculate dot product of two 3D vectors
 * @param {Object} a First vector {x, y, z}
 * @param {Object} b Second vector {x, y, z}
 * @returns {number} Dot product
 */
export function dotProduct3D(a, b) {
  console.log('• [DEBUG] Calculating dot product...')
  console.log('📍 [DEBUG] Vector A:', a)
  console.log('📍 [DEBUG] Vector B:', b)
  
  const result = a.x * b.x + a.y * b.y + a.z * b.z
  
  console.log('✅ [DEBUG] Dot product result:', result)
  
  return result
}

/**
 * Calculate area of a polygon using the shoelace formula
 * Adapted for 3D polygons by projecting to the best-fit plane
 * @param {Array} polygon Array of 3D points
 * @returns {number} Area in square units
 */
export function calculatePolygonArea(polygon) {
  if (!polygon || polygon.length < 3) return 0

  // For horizontal planes, we can use the XZ projection
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
 * Calculate the bounding box of a set of 3D points
 * @param {Array} points Array of 3D points {x, y, z}
 * @returns {Object} Bounding box {min: {x, y, z}, max: {x, y, z}, size: {x, y, z}}
 */
export function getBoundingBox(points) {
  if (!points || points.length === 0) {
    return {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
      size: { x: 0, y: 0, z: 0 }
    }
  }

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minY = Math.min(minY, point.y)
    maxY = Math.max(maxY, point.y)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    size: { 
      x: maxX - minX, 
      y: maxY - minY, 
      z: maxZ - minZ 
    }
  }
}

/**
 * Check if a point is inside a 2D polygon (for horizontal plane checking)
 * Uses the ray casting algorithm
 * @param {Object} point Point to test {x, z}
 * @param {Array} polygon Polygon vertices [{x, z}, ...]
 * @returns {boolean} True if point is inside polygon
 */
export function pointInPolygon2D(point, polygon) {
  if (!polygon || polygon.length < 3) return false

  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].z

    if (((zi > point.z) !== (zj > point.z)) &&
        (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Linear interpolation between two values
 * @param {number} a Start value
 * @param {number} b End value
 * @param {number} t Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Linear interpolation between two 3D points
 * @param {Object} a Start point {x, y, z}
 * @param {Object} b End point {x, y, z}
 * @param {number} t Interpolation factor (0-1)
 * @returns {Object} Interpolated point {x, y, z}
 */
export function lerp3D(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t)
  }
}

/**
 * Clamp a value between min and max
 * @param {number} value Value to clamp
 * @param {number} min Minimum value
 * @param {number} max Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

/**
 * Convert degrees to radians
 * @param {number} degrees Angle in degrees
 * @returns {number} Angle in radians
 */
export function degToRad(degrees) {
  return degrees * Math.PI / 180
}

/**
 * Convert radians to degrees
 * @param {number} radians Angle in radians
 * @returns {number} Angle in degrees
 */
export function radToDeg(radians) {
  return radians * 180 / Math.PI
}

/**
 * Create a 4x4 identity matrix
 * @returns {Float32Array} 4x4 identity matrix
 */
export function createIdentityMatrix() {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ])
}

/**
 * Create a translation matrix
 * @param {number} x Translation X
 * @param {number} y Translation Y
 * @param {number} z Translation Z
 * @returns {Float32Array} 4x4 translation matrix
 */
export function createTranslationMatrix(x, y, z) {
  console.log('🏗️ [DEBUG] Creating translation matrix...')
  console.log('📍 [DEBUG] Translation values:', { x, y, z })
  
  const matrix = new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ])
  
  console.log('📊 [DEBUG] Created translation matrix:', Array.from(matrix))
  console.log('✅ [DEBUG] Translation matrix creation complete')
  
  return matrix
}

/**
 * Extract position from a 4x4 transformation matrix
 * @param {Float32Array} matrix 4x4 transformation matrix
 * @returns {Object} Position {x, y, z}
 */
export function extractPosition(matrix) {
  console.log('📍 [DEBUG] Extracting position from transformation matrix...')
  console.log('📊 [DEBUG] Matrix:', Array.from(matrix.slice(0, 16)))
  
  // In column-major order, translation is in elements 12, 13, 14
  const position = {
    x: matrix[12],
    y: matrix[13],
    z: matrix[14]
  }
  
  console.log('✅ [DEBUG] Extracted position:', position)
  
  return position
}

/**
 * Check if two numbers are approximately equal (within epsilon)
 * @param {number} a First number
 * @param {number} b Second number
 * @param {number} epsilon Tolerance (default: 0.001)
 * @returns {boolean} True if approximately equal
 */
export function approximately(a, b, epsilon = 0.001) {
  return Math.abs(a - b) < epsilon
}

/**
 * Convert a 4x4 matrix from column-major to row-major order
 * @param {Float32Array} columnMajor - Column-major matrix
 * @returns {Float32Array} Row-major matrix
 */
export function columnMajorToRowMajor(columnMajor) {
  console.log('🔄 [DEBUG] Converting matrix from column-major to row-major...')
  console.log('📊 [DEBUG] Input matrix (column-major):', Array.from(columnMajor))
  
  const rowMajor = new Float32Array(16)
  
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      rowMajor[row * 4 + col] = columnMajor[col * 4 + row]
    }
  }
  
  console.log('📊 [DEBUG] Output matrix (row-major):', Array.from(rowMajor))
  console.log('✅ [DEBUG] Matrix conversion complete')
  
  return rowMajor
}

/**
 * Check if a point is inside a polygon (2D projection)
 * @param {Object} point - Point to test {x, z} (using x,z for horizontal plane)
 * @param {Array} polygon - Polygon vertices
 * @returns {boolean} True if point is inside polygon
 */
export function isPointInPolygon(point, polygon) {
  console.log('🎯 [DEBUG] Checking if point is inside polygon...')
  console.log('📍 [DEBUG] Test point:', point)
  console.log('📊 [DEBUG] Polygon vertices:', polygon.length)
  
  let inside = false
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].z
    
    if (((zi > point.z) !== (zj > point.z)) &&
        (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)) {
      inside = !inside
    }
  }
  
  console.log('✅ [DEBUG] Point inside polygon:', inside)
  
  return inside
} 