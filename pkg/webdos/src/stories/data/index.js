import smallJson from '@dreamcatcher-tech/interblock/src/w301-user-apps/src/crm/faker/small'
import templateUrl from './template.pdf'
import { api, apps } from '@dreamcatcher-tech/interblock'
import Debug from 'debug'

const debug = Debug('webdos:stories:data')

const { crm } = apps
const [small] = [smallJson].map((obj) => {
  // update the templates for customers, schedules, and routing
  // TODO we should not need to patch anything
  // maybe data should be moved to a separate repo
  obj.network = obj.network.map((child) => {
    switch (child.path) {
      case 'customers': {
        const { schema, uiSchema } =
          crm.covenant.covenants.customers.installer.state.template
        return {
          ...child,
          state: {
            ...child.state,
            template: { schema, uiSchema },
          },
        }
      }
      case 'schedule':
        return child
      case 'routing': {
        const { schema, uiSchema } = crm.sector.state
        const network = child.network.map((sector) => {
          sector = { ...sector }
          delete sector.state.uiSchema
          sector.state.schema = '..'
          return sector
        })
        return {
          ...child,
          network,
          state: {
            ...child.state,
            template: { schema, uiSchema },
          },
        }
      }
      default:
        return child
    }
  })

  return api.Complex.create(obj)
})

const dataPrefix =
  'https://raw.githubusercontent.com/dreamcatcher-tech/crm-data/de2cc481276effbab55536e17e1d1e4f54c28617/'
const car = {
  blank: {
    url: dataPrefix + 'crm.blank.car',
    path: '/crm',
  },
}

export { small, templateUrl, car }
export default { small, templateUrl, car }
