import { ICalCalendar, ICalCalendarMethod } from 'ical-generator'
import moment from 'moment'
import { hash } from 'ohash'
import { OpenAI } from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'

export interface TextToCalendarOptions {
  /** The source text. */
  text: string

  /** OpenAI model. */
  model: string

  /** OpenAI client. */
  openai?: OpenAI
}

export interface TextToCalendarResult {
  calendar: ICalCalendar
}

/**
 * Converts text to iCalendar events.
 *
 * @param opts Options
 * @returns The result
 */
export async function textToCalendar(
  opts: TextToCalendarOptions,
): Promise<TextToCalendarResult> {
  // Lop off the timezone offset suffix for timestamps. GPT likes to add the timezone offset, but we
  // already handle timezones in a separate response field
  const dateTimeWithoutZone = z
    .string()
    .trim()
    .transform((dateTime) => moment.utc(dateTime.replace(/(T.*)[+-].*$/, '$1')))

  const resultSchema = z.object({
    events: z.array(
      z.object({
        title: z.string().trim().describe('The title of the event'),

        timeStart: dateTimeWithoutZone.describe(
          'The starting datetime of the event',
        ),

        timeEnd: z
          .union([dateTimeWithoutZone, z.null()])
          .describe('If provided, the ending datetime of the event'),

        timeZone: z
          .union([z.string(), z.null()])
          .describe('If provided, the timezone ID for this event'),

        allDay: z
          .boolean()
          .describe(
            'True if the event has no specific time of day, and can occur all day or at any time of day',
          ),

        recurrenceRule: z
          .union([z.string(), z.null()])
          .describe(
            'If this is a recurring event, the repeating rule string in iCalendar RRULE format',
          ),

        description: z
          .union([z.string().trim(), z.null()])
          .describe('Any extra information about the event'),

        location: z
          .union([z.string().trim(), z.null()])
          .describe('The event location'),

        emoji: z
          .union([z.string().trim(), z.null()])
          .describe('A single emoji that best describes this event'),
      }),
    ),
  })

  const openai = opts.openai ?? new OpenAI()
  const chatCompletion = await openai.beta.chat.completions.parse({
    model: opts.model,
    temperature: 0,
    seed: 0,
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
    response_format: zodResponseFormat(resultSchema, 'result'),
  })

  const message = chatCompletion.choices[0].message
  const result = message.parsed
  if (!result) {
    throw new Error(`Invalid response: ${message.refusal ?? 'unknown reason'}`)
  }

  if (process.env.TXT2ICS_DEBUG) {
    console.log(JSON.stringify(result, null, '  '))
  }

  const calendar = new ICalCalendar({
    prodId: 'txt2ics',
    method: ICalCalendarMethod.PUBLISH,
  })

  // The number of times we've processed each event, keyed by hash
  const eventCounts = new Map<string, number>()

  for (const event of result.events) {
    // Use the hash of this event to form its ID instead of randomizing to keep IDs stable
    // as possible between separate runs
    const eventHash = hash(event)
    const eventCount = eventCounts.get(eventHash) ?? 0
    eventCounts.set(eventHash, eventCount + 1)

    calendar.createEvent({
      id: `${eventHash}-${eventCount}`,
      start: event.timeStart,
      end: event.timeEnd,
      summary: `${event.title}${event.emoji ? ` ${event.emoji}` : ''}`,
      description:
        event.description !== event.title ? event.description : undefined,
      location: event.location,
      repeating: event.recurrenceRule,
      allDay: event.allDay,
      timezone: event.timeZone,
      floating: !event.timeZone,

      // Use a fixed TSTAMP when running in Jest to keep things testable
      stamp: process.env.NODE_ENV === 'test' ? new Date(0) : undefined,
    })
  }

  return { calendar }
}
