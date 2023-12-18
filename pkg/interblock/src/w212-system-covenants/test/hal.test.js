import { Interpulse, apps } from '../..'
import dotenv from 'dotenv'
import Debug from 'debug'
const debug = Debug('tests')
dotenv.config({ path: '../../.env' })

describe('HAL', () => {
  it('add customer', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': apps.crm.covenant },
    })
    await engine.bootHal()
    await engine.add('/apps')
    await engine.add('/apps/crm', { covenant: '/crm' })

    // HAL is the executing AI
    const actions = await engine.actions('.HAL')
    debug('HAL actions', actions)
    // Debug.enable('iplog *hal tests *threads *openPath ')
    const maxFunctionCalls = 2
    const result = await actions.user('add a customer', maxFunctionCalls)
    console.dir(result, { depth: Infinity })

    // test that artifact was altered successfully

    // debug('goalie result', result)
  }, 60000)
  it.only('adds a customer using the stuck loop', async () => {
    // watch HAL use the stuckloop
    // control the stucks that are included and searchable.
    // test against some direct similarity searches, and then with preprocessing
    // what the user said to turn it into goal searches.
    // run multiple searches in parallel if what the user wants can
    // be broken down ?  or break it down, and start on the first step first
    // then when complete, move to the second one
    // optimzie this process separately as a module

    const engine = await Interpulse.createCI({
      overloads: { '/crm': apps.crm.covenant },
    })
    await engine.bootHal()
    await engine.add('/apps')
    await engine.add('/apps/crm', { covenant: '/crm' })

    // HAL is the executing AI
    Debug.enable('iplog *hal tests')
    const actions = await engine.actions('.HAL')
    const result = await actions.prompt('add a customer then fix my car')

    console.dir(result, { depth: Infinity })
  }, 20000)
})

/**
 "I want to add a customer"

 This should result in a call to the pathfinder.
 Or HAL could already have the full manual for the current install.
 So the dunno call is to start the stuckloop.

 /dreamcatcher

 1. Break the task down into steps, creating a step object for each step
 2. Run each step in turn, prompting the system with each step task
 3. At the end of each step, reasses the remaining steps
 4. Some steps might need input from the user
 5. The steps should be focused on each directory

When CD occurs, the assistant gets loaded with the state and schema of the
new object, as well as all the actions at that location.

 */

// add errors and remedies into the doc - make a list of errors.
