import React from 'react'
import Debug from 'debug'
import { useRouter } from '../hooks'
const debug = Debug('terminal:widgets:Services')

/**
 * Overlays the map with tooling and inserts geometry layers.
 * Geo layers represent the children of the collection that this component faces
 *
 */

const Geometry = () => {
  const { matchedPath, pulse } = useRouter()
  const title = 'Sites'
  const description = 'Geography of sites'
  const aboveMapStyle = { position: 'relative', pointerEvents: 'none' }
  const hideMapBackgrond = {
    position: 'absolute', // hits top of the map background container
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    background: 'white',
  }
  return (
    <div style={hideMapBackgrond}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

export default Geometry