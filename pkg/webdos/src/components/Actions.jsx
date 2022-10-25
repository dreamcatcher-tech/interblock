import React, { useState } from 'react'
import Form from '@rjsf/mui'
import validator from '@rjsf/validator-ajv6'
import { Card, CardContent, IconButton, Grid, Stack } from '@mui/material'
import LoadingButton from '@mui/lab/LoadingButton'
import { Cancel, Send } from '@mui/icons-material'
import Debug from 'debug'
import PropTypes from 'prop-types'
const debug = Debug('terminal:widgets:Actions')

const Actions = ({ actions, onAction }) => {
  const cards = []
  for (const key in actions) {
    const action = actions[key]
    debug(action)
    cards.push(
      <Action action={action} onAction={onAction} key={cards.length} />
    )
  }
  return <Stack spacing={2}>{cards}</Stack>
}
Actions.propTypes = {
  actions: PropTypes.objectOf(PropTypes.func),
  onAction: PropTypes.func,
}
const Action = ({ action, onAction }) => {
  const { schema } = action
  const { title, ...noTitleSchema } = schema

  const [liveFormData, setLiveFormData] = useState({})
  const [isPending, setIsPending] = useState(false)
  const onBlur = (...args) => {
    debug(`onBlur: `, ...args)
  }
  const onChange = ({ formData }) => {
    debug(`onChange: `, formData)
    setLiveFormData(formData)
  }
  const reset = () => {
    setIsPending(false)
    setLiveFormData({})
  }
  const submit = () => {
    debug('submit', liveFormData)
    const request = action(liveFormData)
    setIsPending(true)
    onAction(request).then(() => {
      setIsPending(false)
    })
  }
  return (
    <Card sx={{ maxWidth: 345 }}>
      <CardContent>
        <Form
          validator={validator}
          disabled={isPending}
          schema={noTitleSchema}
          // uiSchema={uiSchema}
          formData={liveFormData}
          onBlur={onBlur}
          onChange={onChange}
          onSubmit={submit}
        >
          <Grid container justifyContent="space-between">
            <LoadingButton
              type="submit"
              variant="contained"
              color="warning"
              endIcon={<Send />}
              loading={isPending}
              loadingPosition="end"
            >
              {title}
            </LoadingButton>
            <IconButton aria-label="reset" onClick={reset}>
              <Cancel color="secondary" />
            </IconButton>
          </Grid>
        </Form>
      </CardContent>
    </Card>
  )
}
Action.propTypes = {
  action: PropTypes.func,
  onAction: PropTypes.func,
}
export default Actions
