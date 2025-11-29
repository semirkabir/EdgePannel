declare module 'react-simple-maps' {
  import { ReactNode } from 'react'

  export interface Geography {
    rsmKey: string
    properties: Record<string, any>
  }

  export interface GeographiesProps {
    geography: string | object
    children: (props: { geographies: Geography[] }) => ReactNode
  }

  export interface GeographyProps {
    geography: Geography
    fill?: string
    stroke?: string
    strokeWidth?: number
    style?: {
      default?: React.CSSProperties
      hover?: React.CSSProperties
      pressed?: React.CSSProperties
    }
    onClick?: () => void
    onMouseDown?: () => void
    onMouseUp?: () => void
  }

  export interface MarkerProps {
    coordinates: [number, number]
    onClick?: () => void
    children?: ReactNode
  }

  export interface ComposableMapProps {
    projectionConfig?: {
      scale?: number
      center?: [number, number]
    }
    style?: React.CSSProperties
    children?: ReactNode
  }

  export const ComposableMap: React.FC<ComposableMapProps>
  export const Geographies: React.FC<GeographiesProps>
  export const Geography: React.FC<GeographyProps>
  export const Marker: React.FC<MarkerProps>
}

