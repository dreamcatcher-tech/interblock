import React, { useState, useMemo } from 'react'
import { Crisp } from '@dreamcatcher-tech/webdos'
import List from './List'
import PropTypes from 'prop-types'
import Fab from './Fab'
import { packets } from './columns'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'

export const Packets = ({ crisp, onCreate }) => {
  return (
    <>
      <List crisp={crisp} columns={packets} />
      <Fab type="create" disabled={!onCreate} onClick={onCreate} />
    </>
  )
}
Packets.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
  /**
   * Will cd into Drafts and create a new draft.
   */
  onCreate: PropTypes.func,
}
