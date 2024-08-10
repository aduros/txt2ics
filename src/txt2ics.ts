import { ICalCalendar } from 'ical-generator'
import JSON5 from 'json5'
import type { OpenAI } from 'openai'
import {
  tzlib_get_ical_block,
  tzlib_get_timezones,
} from 'timezones-ical-library'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export interface TextToIcsOptions {
  /** The source text. */
  text: string

  /** OpenAI client. */
  openai: OpenAI

  /** OpenAI model. */
  model: string

  /** Default timezone to use for events. */
  defaultTimeZone?: string
}

export interface TextToIcsResult {
  calendar: ICalCalendar
}

/**
 * Converts text to iCalendar events.
 *
 * @param opts Options
 * @returns The result
 */
export async function textToIcs(
  opts: TextToIcsOptions,
): Promise<TextToIcsResult> {
  const parametersSchema = z.object({
    events: z.array(
      z.object({
        title: z.string().describe('The title of the event'),

        timeStart: z.string().describe('The starting datetime of the event'),

        timeEnd: z
          .string()
          .optional()
          .describe('If provided, the ending datetime of the event'),

        timeZone: z
          .string()
          .optional()
          .describe('If provided, the timezone ID for this event'),

        allDay: z
          .boolean()
          .optional()
          .describe(
            'True if the event has no specific time of day, and can occur all day or at any time of day',
          ),

        recurrenceRule: z
          .string()
          .optional()
          .describe(
            'If this is a recurring event, the repeating rule string in iCalendar RRULE format',
          ),

        description: z
          .string()
          .optional()
          .describe('Any extra information about the event'),

        location: z.string().optional().describe('The event location'),

        emoji: z
          .string()
          .optional()
          .describe('A single emoji that best describes this event'),
      }),
    ),
  })

  const chatCompletion = await opts.openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content: 'Extract calendar events from the given text',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: opts.text,
          },
        ],
      },
    ],
    temperature: 0,
    tools: [
      {
        type: 'function',
        function: {
          name: 'onComplete',
          parameters: zodToJsonSchema(parametersSchema),
        },
      },
    ],
    tool_choice: {
      type: 'function',
      function: {
        name: 'onComplete',
      },
    },
    model: opts.model,
  })

  const toolCall = chatCompletion.choices[0]?.message?.tool_calls?.[0]

  if (!toolCall || toolCall.function.name !== 'onComplete') {
    throw new Error('Invalid tool call')
  }

  const result = parametersSchema.parse(
    // We use JSON5 here because sometimes OpenAI returns invalid JSON
    JSON5.parse(toolCall.function.arguments),
  )

  if (process.env.TXT2ICS_DEBUG) {
    console.log(JSON.stringify(result.events, null, '  '))
  }

  const validTimeZones = new Set(tzlib_get_timezones())

  const calendar = new ICalCalendar({
    prodId: 'txt2ics',
    timezone: {
      name: null,
      generator: (tzName) => {
        return validTimeZones.has(tzName)
          ? tzlib_get_ical_block(tzName)[0]
          : null
      },
    },
  })

  for (const event of result.events) {
    calendar.createEvent({
      start: event.timeStart,
      end: event.timeEnd,
      summary: `${event.title}${event.emoji ? ` ${event.emoji}` : ''}`,
      description:
        event.description !== event.title ? event.description : undefined,
      location: event.location,
      repeating: event.recurrenceRule,
      allDay: event.allDay,
      timezone: event.timeZone ?? opts.defaultTimeZone,
    })
  }

  return { calendar }
}
