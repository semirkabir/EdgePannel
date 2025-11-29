export interface User {
  id: string
  email: string
  name?: string
  image?: string
  emailVerified?: Date
}

export interface ApiKeyConfig {
  platform: 'polymarket' | 'kalshi'
  // For Polymarket
  apiKey?: string
  // For Kalshi
  accessKeyId?: string
  privateKey?: string
}

