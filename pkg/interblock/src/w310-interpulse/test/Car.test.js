import { Interpulse } from '../..'
import { Pulse } from '../../w008-ipld'
import { crm } from '../../w301-user-apps'
import Debug from 'debug'

const debug = Debug('tests')

describe('Car', () => {
  test('export', async () => {
    const engine = await Interpulse.createCI({
      overloads: { '/crm': crm.covenant },
    })
    await engine.add('app', '/crm')
    const car = await engine.export('/app')
    debug('car', car)

    const blank = await Interpulse.createCI()
    debug('import start')
    const { roots, count } = await blank.import(car)
    debug('import end')
    expect(count).toMatchSnapshot()
    expect(roots.length).toBe(1)
    const [imported] = roots
    expect(imported).toBeInstanceOf(Pulse)

    await blank.insert(imported.cid.toString(), 'forked')
    const forkedCurrent = await blank.current('forked')
    expect(imported.cid.toString()).toBe(forkedCurrent.cid.toString())
    const schedule = await blank.current('forked/schedules')
    expect(schedule).toBeInstanceOf(Pulse)
    const originalAddress = schedule.getAddress()

    debug('begin write to fork')
    await blank.ping('forked/schedules')
    debug('end write to fork')
    const forkedSchedule = await blank.current('forked/schedules')
    const forkedAddress = forkedSchedule.getAddress()
    expect(forkedAddress.toString()).not.toBe(originalAddress.toString())
  })
})
