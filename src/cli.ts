#!/usr/bin/env node --no-deprecation

import { createReadStream, createWriteStream } from 'node:fs'
import { basename } from 'node:path'
import type { Readable, Writable } from 'node:stream'

import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createProviderRegistry } from 'ai'
import { program } from 'commander'

import { textToCalendar } from './textToCalendar'

function getDefaultModel(): string {
  if (process.env.ANTHROPIC_API_KEY) {
    return 'anthropic:claude-3-7-sonnet-latest'
  }
  if (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY) {
    return 'google:gemini-2.5-pro'
  }
  return 'openai:gpt-4o'
}

program
  .name('txt2ics')
  .description(
    'Transform plain text to an .ics file using LLMs.\n\nMore info: https://github.com/aduros/txt2ics',
  )
  .option(
    '-m, --model <model>',
    'AI model to use (e.g., openai:gpt-4o, anthropic:claude-3-5-sonnet, google:gemini-1.5-pro)',
    getDefaultModel(),
  )
  .option(
    '-u, --base-url <url>',
    'Base URL for the API (optional, for custom endpoints)',
  )
  .option('-o, --output <file>', 'Output file, or "-" to write to stdout', '-')
  .argument('[file]', 'Input text file, or "-" to read from stdin', '-')

  .action(
    async (
      file: string,
      opts: {
        model: string
        baseUrl?: string
        output: string
      },
    ) => {
      const { model: modelName, baseUrl: baseURL } = opts

      const inStream: Readable =
        file === '-' ? process.stdin : createReadStream(file)

      let text = ''
      for await (const chunk of inStream) {
        text += String(chunk)
      }

      const providerRegistry = createProviderRegistry({
        anthropic: createAnthropic({ baseURL }),
        google: createGoogleGenerativeAI({ baseURL }),
        openai: createOpenAI({ baseURL }),
      })
      const model = providerRegistry.languageModel(modelName as never)

      const { calendar } = await textToCalendar({
        text,
        model,
      })

      if (inStream !== process.stdin) {
        calendar.name(basename(file))
      }

      // Some calendar software (Google Calendar) don't support floating times, so we need a default
      // timezone otherwise those will be interpreted as UTC.
      calendar.timezone(Intl.DateTimeFormat().resolvedOptions().timeZone)

      const outStream: Writable =
        opts.output === '-' ? process.stdout : createWriteStream(opts.output)
      outStream.write(calendar.toString() + '\n')
    },
  )

program.parse()
