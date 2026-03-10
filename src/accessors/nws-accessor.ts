import type {
  GeocodedLocation,
  CurrentConditions,
  ForecastPeriod,
  WeatherAlert,
} from "../types/weather-contracts.js";

const USER_AGENT = "DiscordWeatherBot/1.0";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const NWS_BASE = "https://api.weather.gov";
const TIMEOUT_MS = 30_000;

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address: { country_code: string };
}

interface NwsPointData {
  properties: {
    forecast: string;
    forecastGridData: string;
    observationStations: string;
    county: string;
  };
}

interface NwsForecastData {
  properties: {
    periods: Array<{
      name: string;
      startTime: string;
      temperature: number;
      temperatureUnit: string;
      shortForecast: string;
      detailedForecast: string;
      windSpeed: string;
    }>;
  };
}

interface NwsObservationData {
  properties: {
    temperature: { value: number | null; unitCode: string };
    windSpeed: { value: number | null };
    windDirection: { value: number | null };
    relativeHumidity: { value: number | null };
    textDescription: string;
    heatIndex: { value: number | null };
    windChill: { value: number | null };
  };
}

interface NwsAlertFeature {
  properties: {
    id: string;
    event: string;
    severity: string;
    headline: string;
    description: string;
    expires: string;
    senderName: string;
  };
}

export class NwsAccessor {
  async geocode(query: string): Promise<GeocodedLocation> {
    // Try US-biased search first (prevents zip code collisions like 68510 → France)
    const usResult = await this.nominatimSearch(query, "us");
    if (usResult) return usResult;

    // Fall back to global search for international locations
    const globalResult = await this.nominatimSearch(query);
    if (globalResult) return globalResult;

    throw new Error(`Could not find location: ${query}`);
  }

  private async nominatimSearch(
    query: string,
    countryCode?: string,
  ): Promise<GeocodedLocation | null> {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      limit: "1",
      addressdetails: "1",
    });
    if (countryCode) {
      params.set("countrycodes", countryCode);
    }

    const response = await this.fetch(`${NOMINATIM_BASE}/search?${params}`);
    const results = (await response.json()) as NominatimResult[];

    if (results.length === 0) return null;

    const result = results[0];
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon),
      displayName: result.display_name,
      isUS: result.address.country_code === "us",
    };
  }

  async getPointMetadata(lat: number, lon: number): Promise<NwsPointData> {
    const response = await this.fetch(
      `${NWS_BASE}/points/${lat.toFixed(4)},${lon.toFixed(4)}`,
      { Accept: "application/geo+json" },
    );
    return (await response.json()) as NwsPointData;
  }

  async getForecast(forecastUrl: string): Promise<ForecastPeriod[]> {
    const response = await this.fetch(forecastUrl, {
      Accept: "application/geo+json",
    });
    const data = (await response.json()) as NwsForecastData;

    return data.properties.periods.map((p) => ({
      name: p.name,
      startTime: p.startTime,
      temperature: p.temperature,
      temperatureUnit: p.temperatureUnit,
      shortForecast: p.shortForecast,
      detailedForecast: p.detailedForecast,
      windSpeed: p.windSpeed,
    }));
  }

  async getCurrentObservation(stationsUrl: string): Promise<CurrentConditions> {
    const stationsRes = await this.fetch(stationsUrl, {
      Accept: "application/geo+json",
    });
    const stationsData = (await stationsRes.json()) as {
      features: Array<{ properties: { stationIdentifier: string } }>;
    };

    if (stationsData.features.length === 0) {
      throw new Error("No observation stations found nearby.");
    }

    const stationId = stationsData.features[0].properties.stationIdentifier;
    const obsRes = await this.fetch(
      `${NWS_BASE}/stations/${stationId}/observations/latest`,
      { Accept: "application/geo+json" },
    );
    const obs = (await obsRes.json()) as NwsObservationData;
    const props = obs.properties;

    const tempC = props.temperature.value ?? 0;
    const tempF = celsiusToFahrenheit(tempC);
    const feelsLikeC = props.heatIndex.value ?? props.windChill.value ?? tempC;
    const feelsLikeF = celsiusToFahrenheit(feelsLikeC);

    return {
      temperature: Math.round(tempF),
      temperatureC: Math.round(tempC),
      feelsLike: Math.round(feelsLikeF),
      feelsLikeC: Math.round(feelsLikeC),
      humidity: Math.round(props.relativeHumidity.value ?? 0),
      windSpeed: Math.round(mpsToMph(props.windSpeed.value ?? 0)),
      windDirection: degreesToCardinal(props.windDirection.value ?? 0),
      description: props.textDescription || "Unknown",
    };
  }

  async getActiveAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
    const response = await this.fetch(
      `${NWS_BASE}/alerts/active?point=${lat.toFixed(4)},${lon.toFixed(4)}`,
      { Accept: "application/geo+json" },
    );
    const data = (await response.json()) as { features: NwsAlertFeature[] };

    return data.features.map((f) => ({
      id: f.properties.id,
      event: f.properties.event,
      severity: f.properties.severity,
      headline: f.properties.headline ?? "",
      description: f.properties.description ?? "",
      expires: f.properties.expires ?? "",
      senderName: f.properties.senderName ?? "",
    }));
  }

  private async fetch(
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, ...extraHeaders },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`HTTP ${response.status} from ${url}: ${body}`);
      }

      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function celsiusToFahrenheit(c: number): number {
  return (c * 9) / 5 + 32;
}

function mpsToMph(mps: number): number {
  return mps * 2.237;
}

function degreesToCardinal(degrees: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return dirs[index];
}
