import React from 'react'
import { Engine, Syncer } from '..'
import { Routing } from '../components'
import { apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'
const debug = Debug('Routing')

const { faker } = apps.crm
faker.customers.reset()
const sectorsAdd = { add: { path: '/routing', installer: '/crm/routing' } }
const sectorsBatch = faker.routing.generateBatch(2)
const sectorsInsert = { '/routing/batch': { batch: sectorsBatch } }
const listAdd = { add: { path: '/customers', installer: '/crm/customers' } }
const listBatch = faker.customers.generateBatchInside(sectorsBatch, 10)
const listInsert = { '/customers/batch': { batch: listBatch } }
const update = { '/routing/update': { path: '/customers' } }
const cd = { cd: { path: '/routing' } }

export default {
  title: 'Routing',
  component: Routing,
  args: {
    dev: { '/crm': apps.crm.covenant },
    init: [sectorsAdd, sectorsInsert, listAdd, listInsert, update, cd],
  },
}

const Template = (args) => {
  Debug.enable('*Syncer* iplog crm:routing *Routing  *Sorter* *SorterDatum')
  debug('args', args)
  return (
    <Engine {...args}>
      <Syncer>
        <Syncer.UnWrapper path="/routing">
          <Routing />
        </Syncer.UnWrapper>
      </Syncer>
    </Engine>
  )
}

export const Blank = Template.bind({})
Blank.args = { init: [sectorsAdd, listAdd, listInsert, update] }

export const Small = Template.bind({})
