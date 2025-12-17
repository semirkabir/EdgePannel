import * as THREE from 'three'

// Cache for textures to avoid re-creating
const textureCache = new Map<string, THREE.Texture>()

/**
 * Create a procedural Earth texture with continents
 * This is used as a fallback and is generated only once
 */
export function createProceduralEarthTexture(): THREE.Texture {
  const cacheKey = 'procedural-earth'
  
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!
  }

  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!

  // Ocean gradient background
  const oceanGradient = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 0,
    canvas.width / 2, canvas.height / 2, canvas.width / 2
  )
  oceanGradient.addColorStop(0, '#0d3b66')
  oceanGradient.addColorStop(0.5, '#14527a')
  oceanGradient.addColorStop(1, '#0a2540')
  ctx.fillStyle = oceanGradient
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Add subtle grid pattern for ocean
  ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)'
  ctx.lineWidth = 1
  for (let x = 0; x < canvas.width; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, canvas.height)
    ctx.stroke()
  }
  for (let y = 0; y < canvas.height; y += 64) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(canvas.width, y)
    ctx.stroke()
  }

  // Continent colors
  const landColor = '#1a5f2a'
  const landHighlight = '#2d7a40'
  const coastColor = '#3d8b50'

  // Draw continents with more detail
  const drawContinent = (
    cx: number, cy: number, 
    rx: number, ry: number, 
    rotation: number = 0,
    variation: number = 0.2
  ) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(rotation)
    
    // Main land mass
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry))
    gradient.addColorStop(0, landHighlight)
    gradient.addColorStop(0.7, landColor)
    gradient.addColorStop(1, coastColor)
    ctx.fillStyle = gradient

    ctx.beginPath()
    const points = 36
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2
      const varX = 1 + (Math.sin(angle * 5 + cx) * variation)
      const varY = 1 + (Math.cos(angle * 3 + cy) * variation)
      const x = Math.cos(angle) * rx * varX
      const y = Math.sin(angle) * ry * varY
      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  // North America
  drawContinent(380, 280, 200, 140, -0.1, 0.25)
  // Greenland
  drawContinent(540, 150, 60, 90, 0.2, 0.3)
  // South America
  drawContinent(420, 620, 100, 200, 0.15, 0.2)
  // Europe
  drawContinent(1000, 230, 120, 80, 0.1, 0.3)
  // Africa
  drawContinent(1020, 500, 130, 180, 0, 0.15)
  // Asia (main)
  drawContinent(1350, 280, 280, 160, -0.05, 0.2)
  // India
  drawContinent(1280, 450, 70, 100, 0, 0.2)
  // Southeast Asia
  drawContinent(1480, 480, 100, 80, 0.1, 0.3)
  // Australia
  drawContinent(1580, 660, 100, 80, 0, 0.15)
  // Antarctica
  drawContinent(1024, 950, 400, 80, 0, 0.1)

  // Add some cloud-like atmosphere effect
  ctx.globalCompositeOperation = 'overlay'
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    const r = 50 + Math.random() * 100
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  textureCache.set(cacheKey, texture)
  return texture
}

/**
 * Create a simple normal map for terrain effect
 */
export function createProceduralNormalMap(): THREE.Texture {
  const cacheKey = 'procedural-normal'
  
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!
  }

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // Base neutral normal (pointing up)
  ctx.fillStyle = '#8080ff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Add subtle noise for terrain
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10
    data[i] = Math.max(0, Math.min(255, 128 + noise))     // R (x normal)
    data[i + 1] = Math.max(0, Math.min(255, 128 + noise)) // G (y normal)
    // B stays at 255 (z normal pointing out)
  }

  ctx.putImageData(imageData, 0, 0)

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  textureCache.set(cacheKey, texture)
  return texture
}

/**
 * Load Earth texture from CDN with fallback to procedural
 */
export async function loadEarthTexture(): Promise<THREE.Texture> {
  const cacheKey = 'earth-texture'
  
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!
  }

  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader()
    
    // Use a reliable CDN with CORS support
    const urls = [
      // Primary: NASA Blue Marble (lower resolution for faster load)
      'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
      // Fallback: Three.js examples
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
    ]

    let urlIndex = 0

    const tryLoad = () => {
      if (urlIndex >= urls.length) {
        // All URLs failed, use procedural
        console.log('[Globe Texture] Using procedural texture (all URLs failed)')
        const texture = createProceduralEarthTexture()
        textureCache.set(cacheKey, texture)
        resolve(texture)
        return
      }

      const url = urls[urlIndex]
      
      loader.load(
        url,
        (texture) => {
          console.log(`[Globe Texture] Loaded from ${url}`)
          texture.wrapS = THREE.RepeatWrapping
          texture.wrapT = THREE.ClampToEdgeWrapping
          textureCache.set(cacheKey, texture)
          resolve(texture)
        },
        undefined,
        () => {
          console.log(`[Globe Texture] Failed to load from ${url}, trying next...`)
          urlIndex++
          tryLoad()
        }
      )
    }

    // Set a timeout for slow connections
    const timeout = setTimeout(() => {
      console.log('[Globe Texture] Timeout, using procedural texture')
      const texture = createProceduralEarthTexture()
      textureCache.set(cacheKey, texture)
      resolve(texture)
    }, 5000) // 5 second timeout

    tryLoad()
    
    // Clear timeout if texture loads successfully
    setTimeout(() => clearTimeout(timeout), 0)
  })
}

/**
 * Preload all globe textures
 * Call this early in the app lifecycle
 */
export function preloadGlobeTextures(): void {
  // Create procedural textures immediately (they're fast)
  createProceduralEarthTexture()
  createProceduralNormalMap()
  
  // Start loading remote texture in background
  loadEarthTexture().catch(() => {
    // Ignore errors, procedural fallback is already available
  })
}

/**
 * Clear texture cache (useful for memory management)
 */
export function clearTextureCache(): void {
  textureCache.forEach((texture) => {
    texture.dispose()
  })
  textureCache.clear()
}











