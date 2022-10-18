import React from 'react'
import Debug from 'debug'
import { useRouter } from '../hooks'
import OpenDialog from './OpenDialog'
import Datum from './Datum'
const debug = Debug('terminal:widgets:Account')

const Account = () => {
  const { matchedPath, pulse } = useRouter()
  const state = pulse.getState().toJS()
  // TODO assert that it is a Datum ?
  debug(`state`, state)
  const { title = '', description = '' } = state.schema || {}
  return (
    <OpenDialog title={title}>
      <Datum block={pulse} />
    </OpenDialog>
  )
}

export default Account
