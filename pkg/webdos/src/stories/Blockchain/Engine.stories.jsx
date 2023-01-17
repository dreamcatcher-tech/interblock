import React from 'react'
import { system, api, apps, Crisp } from '@dreamcatcher-tech/interblock'
import { Engine, Syncer } from '../..'
import { App } from '../..'
import PropTypes from 'prop-types'
import Debug from 'debug'

export default {
  title: 'Blockchain/Crisp',
  // component: Actions,
  args: {
    repo: 'interpulse-storybook',
    dev: { '/dpkg/crm': apps.crm.covenant },
  },
}

const Test = ({ crisp }) => {
  return <div>{JSON.stringify(crisp, null, 2)}</div>
}
Test.propTypes = {
  crisp: PropTypes.instanceOf(Crisp),
}

const Template = (args) => {
  Debug.enable('webdos:Engine *Crisp *Syncer iplog* *Nav interpulse')
  return (
    <Engine {...args}>
      <Syncer path="/crm">
        <App />
      </Syncer>
    </Engine>
  )
}

export const Basic = Template.bind({})

export const CRM = Template.bind({})
CRM.args = {
  ram: true,
  // TODO make init be a function that does anything at all ?
  init: [{ add: { path: 'crm', installer: '/dpkg/crm' } }],
}

export const CAR = Template.bind({})
const dataPrefix =
  'https://raw.githubusercontent.com/dreamcatcher-tech/crm-data/de2cc481276effbab55536e17e1d1e4f54c28617/'
CAR.args = {
  ram: true,
  car: { url: dataPrefix + 'crm.blank.car', path: '/crm' },
}
