import PropTypes from 'prop-types'
import { api } from '@dreamcatcher-tech/interblock'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import React, { useState, useEffect } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CardHeader from '@mui/material/CardHeader'
import Card from '@mui/material/Card'
import IconButton from '@mui/material/IconButton'
import Edit from '@mui/icons-material/Edit'
import Cancel from '@mui/icons-material/Cancel'
import Save from '@mui/icons-material/Save'
import { Actions } from '.'
import assert from 'assert-fast'
import Debug from 'debug'
const debug = Debug('terminal:widgets:DatumHOC')

export default function DatumHOC(Child) {
  const theme = createTheme()
  const noDisabled = createTheme({
    palette: { text: { disabled: '0 0 0' } },
  })
  const Datum = ({
    complex,
    collapsed,
    viewOnly,
    onEdit,
    editing,
    ...props
  }) => {
    // TODO verify the covenant is a datum
    // TODO verify the chain children match the schema children
    assert(!viewOnly || !editing, 'viewOnly and editing are mutually exclusive')

    const [formData, setFormData] = useState(complex.state.formData)
    const [isPending, setIsPending] = useState(false)
    const [isEditing, setIsEditing] = useState(editing)
    const [expanded, setExpanded] = useState(!collapsed)
    const [startingState, setStartingState] = useState(complex.state)
    if (startingState !== complex.state) {
      debug('state changed', startingState, complex.state)
      setStartingState(complex.state)
      setFormData(complex.state.formData)
      // TODO alert if changes not saved
    }
    const isDirty = formData !== complex.state.formData
    debug('isDirty', isDirty)
    const onChange = ({ formData }) => {
      debug(`onChange: `, formData)
      setFormData(formData)
    }
    const onIsEditing = (isEditing) => {
      setIsEditing(isEditing)
      onEdit && onEdit(isEditing)
    }

    const onSubmit = () => {
      debug('onSubmit', formData)
      setIsPending(true)
      complex.actions.set(formData).then(() => {
        setIsPending(false)
        onIsEditing(false)
      })
    }
    const [trySubmit, setTrySubmit] = useState(false)
    useEffect(() => {
      if (trySubmit) {
        setTrySubmit(false)
        debug('trySubmit lowered')
      }
    }, [trySubmit])
    const onSave = (e) => {
      debug('onSave', e)
      e.stopPropagation()
      setTrySubmit(true)
    }
    const onCancel = (e) => {
      debug('onCancel', e)
      e.stopPropagation()
      onIsEditing(false)
      if (isDirty) {
        setFormData(complex.state.formData)
      }
    }
    const Editing = (
      <>
        <IconButton onClick={onSave}>
          <Save color={isPending ? 'disabled' : 'primary'} />
        </IconButton>
        <IconButton onClick={onCancel}>
          <Cancel color={isPending ? 'disabled' : 'secondary'} />
        </IconButton>
      </>
    )
    const onStartEdit = (e) => {
      debug('onEdit', e)
      setExpanded(true)
      e.stopPropagation()
      onIsEditing(true)
    }
    const Viewing = (
      <IconButton onClick={onStartEdit}>
        <Edit color="primary" />
      </IconButton>
    )
    const Blank = (
      <IconButton>
        <Edit color="disabled" />
      </IconButton>
    )
    const onExpand = (e, isExpanded) => {
      if (isEditing) {
        if (isDirty) {
          return
        }
        onCancel(e)
      }
      setExpanded(isExpanded)
    }
    let { schema } = complex.state
    if (schema === '..') {
      schema = complex.parent().state.template.schema
    }
    const { title } = schema
    const { set, ...extraActions } = complex.actions
    debug('actions', complex.actions)
    return (
      <Card>
        <Accordion expanded={expanded} onChange={onExpand}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon fontSize="large" />}
            sx={{ display: 'flex' }}
          >
            <CardHeader title={title} sx={{ p: 0, flexGrow: 1 }} />
            {isEditing ? Editing : viewOnly ? Blank : Viewing}
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column' }}>
            <ThemeProvider theme={isEditing ? theme : noDisabled}>
              <Child
                {...{
                  complex,
                  pending: isPending,
                  viewOnly: !isEditing,
                  onChange,
                  formData,
                  trySubmit,
                  onSubmit,
                  ...props,
                }}
              />
              <Actions actions={extraActions}></Actions>
            </ThemeProvider>
          </AccordionDetails>
        </Accordion>
      </Card>
    )
  }
  Datum.propTypes = {
    complex: PropTypes.instanceOf(api.Complex).isRequired,
    /**
     * Used in testing to start the component in collapsed mode
     */
    collapsed: PropTypes.bool,
    /**
     * Show no edit button - all fields are readonly
     */
    viewOnly: PropTypes.bool,
    /**
     * Notify when the component starts and stops editing
     */
    onEdit: PropTypes.func,
    /**
     * Used in testing to start the component in editing mode
     */
    editing: PropTypes.bool,
  }
  return Datum
}
