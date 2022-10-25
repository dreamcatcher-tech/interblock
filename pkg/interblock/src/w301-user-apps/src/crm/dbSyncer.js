import Debug from 'debug'
const debug = Debug('crm:dbSyncer')
/**
 * Could make this stream in, so as soon as data is received, it updates
 */
const api = {
  start: {
    type: 'object',
    title: 'START',
    description: `Start a synchronization with the database`,
    properties: {
      chunkSize: {
        type: 'integer',
        description: 'How many records to pull down at a time',
        default: 10,
      },
    },
  },
  stop: {
    type: 'object',
    title: 'STOP',
    description: `Stop a running synchronization`,
  },
}
const state = {
  schema: {
    title: 'Database Sync',
    type: 'object',
    additionalProperties: false,
    properties: {
      lastSyncTime: { type: 'integer' },
      dbLastUpdatedTime: { type: 'string' },
      syncState: {
        enum: ['IDLE', 'SYNCING', 'ERROR'],
        default: 'IDLE',
      },
      username: { type: 'string' },
      password: { type: 'string' },
      url: { type: 'string' },
    },
  },
  uiSchema: {
    syncState: { 'ui:readonly': true },
    password: { 'ui:widget': 'password' },
    'ui:submitButtonOptions': {
      norender: true,
    },
  },
}
const reducer = ({ type, payload }) => {
  debug(type, payload)
}

const name = state.schema.title
export { name, api, state, reducer }
