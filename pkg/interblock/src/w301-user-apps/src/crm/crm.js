const address = (title) => ({
  title,
  type: 'object',
  additionalProperties: false,
  properties: {
    address: { type: 'string', faker: 'address.streetAddress' },
  },
})
const gps = {
  title: 'Service GPS',
  type: 'object',
  description: `If no lat or long, then the location is not set yet`,
  additionalProperties: false,
  required: [],
  properties: {
    latitude: { type: 'number', faker: 'address.latitude' },
    longitude: { type: 'number', faker: 'address.longitude' },
  },
}
export const installer = {
  network: {
    schedule: {
      covenant: 'datum',
      state: {
        formData: {
          commonDate: '2020-01-01',
        },
        uiSchema: 'schedule',
      },
      network: {
        modifications: {
          // any manual changes to the computed paths
          // might include reconciled manifests too
          covenant: 'collection',
          state: {
            datumTemplate: {},
          },
        },
      },
    },
    // services: { covenant: 'datum' },
    customers: {
      covenant: 'collection',
      state: {
        template: {
          type: 'DATUM',
          schema: {
            title: 'Customer',
            type: 'object',
            required: ['custNo', 'name'],
            properties: {
              custNo: {
                title: 'Customer Number',
                type: 'integer',
                minimum: 1,
                maximum: 100000,
              },
              name: { title: 'Name', type: 'string', faker: 'name.findName' },
              mobile: {
                title: 'Mobile',
                type: 'string',
                faker: 'phone.phoneNumber',
              },
              phone: {
                title: 'Phone',
                type: 'string',
                faker: 'phone.phoneNumber',
              },
              email: {
                title: 'Email',
                type: 'string',
                format: 'email',
                faker: 'internet.email',
              },
              isEmailVerified: {
                title: 'Email Verified',
                type: 'boolean',
                default: false,
              },
              serviceAddress: address('Service Address'),
              serviceGps: gps,
              billingAddress: address('Billing Address'),
              importedHash: { type: 'string', faker: 'git.commitSha' },
            },
          },
          uiSchema: {
            importedHash: { 'ui:widget': 'hidden' },
            isEmailVerified: { 'ui:readonly': true },
            custNo: { 'ui:readonly': true },
          },
          namePath: ['custNo'],
        },
      },
    },
    routing: {},
    // banking: { covenant: 'datum' },
    settings: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'Settings',
          type: 'object',
          required: ['isTerminalVisible'],
          additionalProperties: false,
          properties: {
            isTerminalVisible: {
              title: 'Show Terminal',
              type: 'boolean',
              default: true,
            },
            isGuiVisible: {
              title: 'Show GUI',
              type: 'boolean',
              default: true,
            },
          },
        },
      },
    },
    about: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'About CRM',
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
          },
        },
        formData: {
          title: 'CRM',
          description: 'Simple Customer Relationship Management with mapping',
        },
      },
    },
    account: {
      covenant: 'datum',
      state: {
        schema: {
          title: 'Account',
          type: 'object',
          properties: {
            name: { title: 'Name', type: 'string' },
            email: {
              title: 'Email',
              type: 'string',
              format: 'email',
            },
          },
        },
      },
    },
  },
}

export const name = 'CRM'
