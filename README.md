# txt2ics

`txt2ics` is a tool for converting free-form text into an .ics/.ical calendar using LLMs.

The main goal of this project is to allow me to keep my calendar in [plain text](https://aduros.com/blog/returning-to-text/) while still getting the benefits of an actual calendar (notifications, syncing to devices, etc).

There are projects like [markwhen](https://markwhen.com/) for this which look amazing, but I'm too lazy to learn and stick to the syntax. I just want to jot wobbly human text into a file and have it show up on my calendar.

## Features

- Extract events from your calendar.txt with basic info like names, start time, end time
- Also includes any useful metadata to events like location, description, and emoji icon
- Support for recurring events
- Pretty good(?) support for multiple time zones

## Installing

1. Run `npm install -g txt2ics@latest` to install.
2. Set up an API key for your preferred model provider:
   - **OpenAI**: Set `$OPENAI_API_KEY` (get it [here](https://platform.openai.com/account/api-keys))
   - **Anthropic**: Set `$ANTHROPIC_API_KEY` (get it [here](https://console.anthropic.com/))
   - **Google**: Set `$GEMINI_API_KEY` or `$GOOGLE_API_KEY` (get it [here](https://ai.google.dev/))

The CLI will automatically use the appropriate default model based on which API key is available.

## Usage

```shell
# Use default model (based on available API key)
txt2ics calendar.md -o calendar.ics

# Specify a specific model with provider prefix
txt2ics calendar.md -o calendar.ics --model openai:gpt-4o
txt2ics calendar.md -o calendar.ics --model anthropic:claude-3-5-sonnet-20241022
txt2ics calendar.md -o calendar.ics --model google:gemini-1.5-pro
```

To see all options, run `txt2ics --help`.

For ideas of what is supported, check out the [test cases](./test). My own personal calendar is currently structured similar to [agenda.test.md](./test/agenda.test.md), but different formats should also work fine.

For Google Calendar users, upload the .ics to your web server (give it a password-like filename and keep the URL a secret) and [add using the URL here](https://calendar.google.com/calendar/u/0/r/settings/addbyurl).

## Disclaimers

It's GPT, so it may fall apart in mysterious ways at any moment. This includes hallucinated events,  events at wrong times, and **missed events**. So far it seems to work well for my day-to-day casual use... but don't rely on tools like this if your life and livelihood are on the line.

It also sends your text calendar to your chosen model provider (OpenAI, Anthropic, or Google), so please consider the privacy implications of that.
