import * as chrono from "chrono-node";

export interface ParsedWeatherInput {
  location: string;
  targetDate: Date | undefined;
}

export function parseWeatherInput(input: string): ParsedWeatherInput {
  const parsed = chrono.parse(input, new Date(), { forwardDate: true });

  if (parsed.length === 0) {
    return { location: input.trim(), targetDate: undefined };
  }

  const match = parsed[0];
  const targetDate = match.start.date();

  // Remove the matched date text from the input to get the location
  const before = input.slice(0, match.index).trim();
  const after = input.slice(match.index + match.text.length).trim();
  const location = [before, after].filter(Boolean).join(" ").trim();

  return { location, targetDate };
}
