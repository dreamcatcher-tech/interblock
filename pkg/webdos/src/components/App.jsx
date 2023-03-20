import Box from '@mui/system/Box'
import { Crisp } from '@dreamcatcher-tech/interblock'
import React from 'react'
import { Glass, Nav, Schedules, CollectionList, Routing } from '.'
import PropTypes from 'prop-types'
import Debug from 'debug'
const debug = Debug('webdos:components:App')

export default function App({ crisp }) {
  const { wd } = crisp
  debug('wd', wd)
  // TODO replace lazy with https://www.npmjs.com/package/react-lazyload
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
      }}
    >
      <>
        <Box sx={{ zIndex: 1 }}>
          <Nav crisp={crisp} />
        </Box>
        {isLoading(crisp) ? (
          <div>Loading...</div>
        ) : (
          <>
            <Glass.Lazy show={wd.startsWith('/schedules')}>
              <Schedules crisp={crisp.getChild('schedules')} />
            </Glass.Lazy>
            <Glass.Lazy show={wd.startsWith('/customers')}>
              <CollectionList crisp={crisp.getChild('customers')} />
            </Glass.Lazy>
            <Glass.Lazy show={wd.startsWith('/routing')}>
              <Routing crisp={crisp.getChild('routing')} />
            </Glass.Lazy>
          </>
        )}
      </>
    </Box>
  )
}
App.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const isLoading = (crisp) => {
  if (crisp.isLoadingChildren) {
    return true
  }
  return (
    !crisp.hasChild('schedules') ||
    !crisp.hasChild('customers') ||
    !crisp.hasChild('routing')
  )
}
