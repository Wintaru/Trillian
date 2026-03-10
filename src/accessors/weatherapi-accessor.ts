import type {
  GeocodedLocation,
  CurrentConditions,
  ForecastPeriod,
  WeatherAlert,
} from "../types/weather-contracts.js";

const BASE_URL = "https://api.weatherapi.com/v1";
const TIMEOUT_MS = 10_000;

interface WeatherApiForecastResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
  };
  current: {
    temp_f: number;
    temp_c: number;
    feelslike_f: number;
    feelslike_c: number;
    humidity: number;
    wind_mph: number;
    wind_dir: string;
    condition: { text: string };
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        condition: { text: string };
        maxwind_mph: number;
        daily_chance_of_rain: number;
      };
    }>;
  };
  alerts?: {
    alert: Array<{
      headline: string;
      event: string;
      severity: string;
      desc: string;
      expires: string;
      note: string;
    }>;
  };
}

export class WeatherApiAccessor {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getForecast(query: string): Promise<{
    location: GeocodedLocation;
    current: CurrentConditions;
    forecast: ForecastPeriod[];
    alerts: WeatherAlert[];
    forecastUrl: string;
  }> {
    const params = new URLSearchParams({
      key: this.apiKey,
      q: query,
      days: "3",
      aqi: "no",
      alerts: "yes",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`${BASE_URL}/forecast.json?${params}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`WeatherAPI returned ${response.status}: ${body}`);
      }

      const data = (await response.json()) as WeatherApiForecastResponse;
      return this.normalize(data);
    } finally {
      clearTimeout(timeout);
    }
  }

  private normalize(data: WeatherApiForecastResponse): {
    location: GeocodedLocation;
    current: CurrentConditions;
    forecast: ForecastPeriod[];
    alerts: WeatherAlert[];
    forecastUrl: string;
  } {
    const loc = data.location;
    const locationDisplay = loc.region
      ? `${loc.name}, ${loc.region}, ${loc.country}`
      : `${loc.name}, ${loc.country}`;

    const location: GeocodedLocation = {
      lat: loc.lat,
      lon: loc.lon,
      displayName: locationDisplay,
      isUS: loc.country === "United States of America",
    };

    const current: CurrentConditions = {
      temperature: Math.round(data.current.temp_f),
      temperatureC: Math.round(data.current.temp_c),
      feelsLike: Math.round(data.current.feelslike_f),
      feelsLikeC: Math.round(data.current.feelslike_c),
      humidity: data.current.humidity,
      windSpeed: Math.round(data.current.wind_mph),
      windDirection: data.current.wind_dir,
      description: data.current.condition.text,
    };

    const forecast: ForecastPeriod[] = data.forecast.forecastday.map((day) => ({
      name: day.date,
      startTime: `${day.date}T12:00:00`,
      temperature: Math.round(day.day.maxtemp_f),
      temperatureUnit: "F",
      shortForecast: `${day.day.condition.text}, High ${Math.round(day.day.maxtemp_f)}F / Low ${Math.round(day.day.mintemp_f)}F`,
      detailedForecast: `${day.day.condition.text}. High of ${Math.round(day.day.maxtemp_f)}F, low of ${Math.round(day.day.mintemp_f)}F. Max wind ${Math.round(day.day.maxwind_mph)} mph. ${day.day.daily_chance_of_rain}% chance of rain.`,
      windSpeed: `${Math.round(day.day.maxwind_mph)} mph`,
    }));

    const alerts: WeatherAlert[] = (data.alerts?.alert ?? []).map((a, i) => ({
      id: `weatherapi-${loc.lat}-${loc.lon}-${i}-${a.event}`,
      event: a.event || "Weather Alert",
      severity: a.severity || "Unknown",
      headline: a.headline || "",
      description: a.desc || "",
      expires: a.expires || "",
      senderName: a.note || "WeatherAPI.com",
    }));

    const forecastUrl = `https://www.weatherapi.com/weather/q/${encodeURIComponent(`${loc.lat},${loc.lon}`)}`;

    return { location, current, forecast, alerts, forecastUrl };
  }
}
