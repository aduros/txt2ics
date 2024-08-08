import JSON5 from 'json5'
import type { OpenAI } from 'openai'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

export interface TextToIcsOptions {
  /** The source text. */
  text: string

  /** OpenAI client. */
  openai: OpenAI

  /** OpenAI model. */
  model: string
}

export interface TextToIcsResult {
  /** The .ics iCalendar file content. */
  ics: string
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
    events: z
      .array(
        z.object({
          title: z.string().describe('The title of the event'),
          description: z
            .string()
            .optional()
            .describe('Any extra information about the event'),
          timeStart: z.string().describe('The starting datetime of the event'),
          timeEnd: z
            .string()
            .optional()
            .describe('The end datetime of the event'),
          allDay: z
            .boolean()
            .optional()
            .describe(
              'True if the event does not start or end at a specific time and occurs all day on the dates given',
            ),
          location: z.string().optional().describe('The event location'),
          recurrenceRule: z
            .string()
            .optional()
            .describe(
              'For recurring events, the repeating rule string in iCalendar RRULE format',
            ),
        }),
      )
      .describe('Only include a single item for each event'),
  })

  const chatCompletion = await opts.openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        // content: `Extract calendar events from the given text. The current datetime: ${new Date().toISOString()}`,
        content: `Extract calendar events from the given text`,
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

  if (process.env.TXT2ICS_DEBUG === '1') {
    console.log(JSON.stringify(result.events, null, '  '))
  }

  const creationTime = toIcsDate(new Date().toISOString(), false)

  const ics = [
    'BEGIN:VCALENDAR',
    'PRODID:txt2ics',
    'VERSION:2.0',
    result.events
      .map((event) => {
        const lines = [
          'BEGIN:VEVENT',
          `UID:${randomId()}`,
          `SUMMARY:${oneLine(event.title)}`,
          `DTSTAMP:${creationTime}`,
          `DTSTART:${toIcsDate(event.timeStart, event.allDay)}`,
        ]
        if (event.timeEnd) {
          lines.push(`DTEND:${toIcsDate(event.timeEnd, event.allDay)}`)
        }
        if (event.location) {
          lines.push(`LOCATION:${oneLine(event.location)}`)
        }
        if (event.description && event.description !== event.title) {
          lines.push(`DESCRIPTION:${oneLine(event.description)}`)
        }
        if (event.recurrenceRule) {
          lines.push(`RRULE:${event.recurrenceRule.replace(/^RRULE:/, '')}`)
        }
        lines.push('END:VEVENT')
        return lines.join('\n')
      })
      .join('\n'),
    'END:VCALENDAR',
  ].join('\n')

  return {
    ics,
  }
}

function oneLine(text: string) {
  return text.split('\n')[0]
}

function randomId() {
  const base62 =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  let str = ''
  for (let ii = 0; ii < 22; ++ii) {
    str += base62.charAt((Math.random() * 62) >>> 0)
  }
  return str
}

function pad(i: number) {
  return i < 10 ? `0${i}` : i
}

function toIcsDate(dateString: string, ignoreTime: boolean | undefined) {
  const timestamp = Date.parse(dateString)
  if (isNaN(timestamp)) {
    throw new Error(`Invalid date: ${dateString}`)
  }

  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hour = pad(date.getHours())
  const minute = pad(date.getMinutes())
  const second = pad(date.getSeconds())

  const timeSuffix = ignoreTime ? '' : `T${hour}${minute}${second}`
  return `${year}${month}${day}${timeSuffix}`
}
