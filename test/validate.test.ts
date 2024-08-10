import { readFile } from 'node:fs/promises'

import { globSync } from 'glob'

import { textToCalendar } from '../src'

// Skip for now, output isn't deterministic enough to test :(
describe.skip('Validate output', () => {
  const inputFiles = globSync(`*.test.md`, { absolute: false, cwd: __dirname })

  it.each(inputFiles)(
    '%s',
    async (inputFile) => {
      const text = await readFile(`${__dirname}/${inputFile}`, 'utf8')
      const { calendar } = await textToCalendar({
        text,
        model: 'gpt-4o-2024-08-06',
      })
      expect(calendar.toString()).toMatchSnapshot()
    },
    15000,
  )
})
