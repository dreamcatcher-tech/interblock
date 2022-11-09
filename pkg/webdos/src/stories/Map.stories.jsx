import React from 'react'
import { Map } from '../components'
import Debug from 'debug'
import { Card, CardContent, Grid, Button } from '@mui/material'
import { apps } from '@dreamcatcher-tech/interblock'
const { faker } = apps.crm

export default {
  title: 'Map',
  component: Map,
  parameters: { layout: 'fullscreen' },
  args: {
    onCreate: (geoJson) => {
      console.log('create', geoJson)
    },
    onEdit: (geoJson) => {
      console.log('edit', geoJson)
    },
  },
}
const wrap = (children) => {
  Debug.enable('*Map')

  return (
    <div
      style={{
        minHeight: '320px',
        width: '100%',
        height: '100%',
        background: 'purple',
        display: 'flex',
      }}
    >
      {children}
    </div>
  )
}
const Template = (args) => wrap(<Map {...args} />)

export const Basic = Template.bind({})

export const OverDraw = (args) => {
  const button = (
    <Button sx={{ bgcolor: 'red', height: 30, m: 5 }}>TEST BUTTON</Button>
  )
  return wrap(
    <>
      <Map {...args} />
      {button}
      {button}
    </>
  )
}
export const CardOverDraw = (args) => {
  return (
    <>
      <Map>
        <Grid container>
          <Grid padding={3} item>
            <Card>
              <CardContent>This content should appear over the Map</CardContent>
            </Card>
          </Grid>
        </Grid>
      </Map>
    </>
  )
}
export const CardColumn = (args) => {
  return (
    <>
      <Map>
        <Grid container>
          <Grid padding={3} item>
            <Card style={{ minHeight: '200px' }}>
              <CardContent>Right hand side is draggable</CardContent>
            </Card>
          </Grid>
        </Grid>
      </Map>
    </>
  )
}
export const NoPolygons = Template.bind({})
NoPolygons.args = {
  onCreate: undefined,
}
export const Polygons = Template.bind({})
// More on interaction testing: https://storybook.js.org/docs/react/writing-tests/interaction-testing
Polygons.args = {
  complex: faker.child('routing'),
  customers: false,
}

export const Customers = Template.bind({})
Customers.args = {
  complex: faker.child('routing'),
  showCustomers: true,
}
