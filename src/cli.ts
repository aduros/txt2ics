#!/usr/bin/env node --no-deprecation

import { createReadStream, createWriteStream } from 'node:fs'
import { basename } from 'node:path'
import type { Readable, Writable } from 'node:stream'

import { program } from 'commander'
import OpenAI from 'openai'

import { textToIcs } from './txt2ics'

program
  .name('txt2ics')
  .description(
    'Transform plain text to an .ics file using GPT.\n\nMore info: https://github.com/aduros/txt2ics',
  )
  .option('-m, --model <model>', 'OpenAI model to use', 'gpt-4o-2024-08-06')
  .option('-o, --output <file>', 'Output file, or "-" to write to stdout', '-')
  .argument('[file]', 'Input text file, or "-" to read from stdin', '-')

  .action(
    async (
      file: string,
      opts: {
        model: string
        output: string
      },
    ) => {
      const { model } = opts
      const openai = new OpenAI()

      const inStream: Readable =
        file === '-' ? process.stdin : createReadStream(file)

      let text = ''
      for await (const chunk of inStream) {
        text += String(chunk)
      }

      const { calendar } = await textToIcs({
        text,
        openai,
        model,
        defaultTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })

      if (inStream !== process.stdin) {
        calendar.name(basename(file))
      }

      const outStream: Writable =
        opts.output === '-' ? process.stdout : createWriteStream(opts.output)
      outStream.write(calendar.toString() + '\n')
    },
  )

program.parse()
