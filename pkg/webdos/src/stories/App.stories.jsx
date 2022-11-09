import React from 'react'
import { App } from '../components'
import Debug from 'debug'
const debug = Debug('App')
import { apps } from '@dreamcatcher-tech/interblock'
const { crm } = apps

export default {
  title: 'App',
  component: App,
}

const Template = (args) => {
  Debug.enable('*App *Nav *Date')
  debug('complex', crm.faker)
  const cd = (path) => {
    debug('cd', path)
    setComplex(complex.setWd(path))
  }
  const [complex, setComplex] = React.useState(crm.faker.addAction({ cd }))
  debug('render')
  return <App complex={complex} />
}

export const Basic = Template.bind({})
Basic.args = {}
