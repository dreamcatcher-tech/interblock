import React from 'react'
import { Nav } from '../components'
import complex from './topProps'
import Debug from 'debug'
const debug = Debug('Nav')
Debug.enable('*Nav')

export default {
  title: 'Nav',
  component: Nav,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    // layout: 'fullscreen',
  },

  args: { complex },
}

const Template = (args) => {
  const [wd, setWd] = React.useState(args.complex.wd)
  args.complex = args.complex.setWd(wd).addAction({
    cd: (path) => {
      debug('cd', path)
      setWd(path)
    },
  })
  return <Nav {...args} />
}

export const Basic = Template.bind({})

export const Selection = Template.bind({})
Selection.args = { complex: complex.setWd('/customers') }

export const NoSettings = Template.bind({})
NoSettings.args = {
  complex: complex.rm('settings'),
}
