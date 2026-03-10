import type { NwsAccessor } from "../accessors/nws-accessor.js";
import type { WeatherApiAccessor } from "../accessors/weatherapi-accessor.js";
import type {
  GetWeatherRequest,
  GetWeatherResponse,
  GetAlertsRequest,
  GetAlertsResponse,
  GeocodedLocation,
  ForecastPeriod,
} from "../types/weather-contracts.js";
import * as logger from "../utilities/logger.js";

const NWS_MAX_DAYS = 7;
const WEATHERAPI_MAX_DAYS = 3;

export class WeatherEngine {
  private geocodeCache = new Map<string, GeocodedLocation>();

  constructor(
    private nwsAccessor: NwsAccessor,
    private weatherApiAccessor: WeatherApiAccessor | null,
  ) {}

  private async geocode(location: string): Promise<GeocodedLocation> {
    const cached = this.geocodeCache.get(location);
    if (cached) return cached;
    try {
      const geo = await this.nwsAccessor.geocode(location);
      this.geocodeCache.set(location, geo);
      return geo;
    } catch (err) {
      if (!this.weatherApiAccessor) throw err;
      logger.warn(`Nominatim geocode failed, falling back to WeatherAPI:`, err);
      const result = await this.weatherApiAccessor.getForecast(location);
      this.geocodeCache.set(location, result.location);
      return result.location;
    }
  }

  async getWeather(request: GetWeatherRequest): Promise<GetWeatherResponse> {
    if (!request.location) {
      throw new Error("No location provided. Set WEATHER_LOCATION or pass a location.");
    }

    const geo = await this.geocode(request.location);

    if (request.targetDate) {
      this.validateTargetDate(request.targetDate, geo.isUS);
    }

    let response: GetWeatherResponse;

    if (geo.isUS) {
      try {
        response = await this.getWeatherFromNws(geo);
      } catch (err) {
        logger.warn(`NWS failed for ${geo.displayName}, trying WeatherAPI fallback:`, err);
        if (request.targetDate) {
          this.validateTargetDate(request.targetDate, false);
        }
        response = await this.getWeatherFromWeatherApi(request.location);
      }
    } else {
      response = await this.getWeatherFromWeatherApi(request.location);
    }

    if (request.targetDate) {
      response = {
        ...response,
        forecast: this.filterForecastByDate(response.forecast, request.targetDate),
        targetDate: request.targetDate,
      };
    }

    return response;
  }

  async getAlerts(request: GetAlertsRequest): Promise<GetAlertsResponse> {
    if (!request.location) {
      throw new Error("No location provided.");
    }

    const geo = await this.geocode(request.location);

    if (geo.isUS) {
      try {
        const alerts = await this.nwsAccessor.getActiveAlerts(geo.lat, geo.lon);
        return { location: geo, alerts, provider: "nws" };
      } catch (err) {
        logger.warn(`NWS alerts failed, trying WeatherAPI fallback:`, err);
      }
    }

    return this.getAlertsFromWeatherApi(request.location, geo);
  }

  private async getWeatherFromNws(geo: GeocodedLocation): Promise<GetWeatherResponse> {
    const pointData = await this.nwsAccessor.getPointMetadata(geo.lat, geo.lon);
    const props = pointData.properties;

    const [forecast, current, alerts] = await Promise.all([
      this.nwsAccessor.getForecast(props.forecast),
      this.nwsAccessor.getCurrentObservation(props.observationStations),
      this.nwsAccessor.getActiveAlerts(geo.lat, geo.lon),
    ]);

    const forecastUrl = `https://forecast.weather.gov/MapClick.php?lat=${geo.lat}&lon=${geo.lon}`;

    return {
      location: geo,
      current,
      forecast,
      alerts,
      forecastUrl,
      provider: "nws",
    };
  }

  private async getWeatherFromWeatherApi(location: string): Promise<GetWeatherResponse> {
    if (!this.weatherApiAccessor) {
      throw new Error(
        "International locations require a WeatherAPI.com key. Set the WEATHERAPI_KEY environment variable.",
      );
    }

    const result = await this.weatherApiAccessor.getForecast(location);
    return {
      ...result,
      provider: "weatherapi",
    };
  }

  private validateTargetDate(targetDate: Date, isUS: boolean): void {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      throw new Error("I can't look up weather for past dates.");
    }

    const maxDays = isUS ? NWS_MAX_DAYS : WEATHERAPI_MAX_DAYS;
    if (diffDays > maxDays) {
      throw new Error(
        `That date is too far out. I can only look up forecasts up to ${maxDays} days ahead.`,
      );
    }
  }

  private filterForecastByDate(forecast: ForecastPeriod[], targetDate: Date): ForecastPeriod[] {
    const targetStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

    const matching = forecast.filter((p) => {
      if (!p.startTime) return false;
      return p.startTime.startsWith(targetStr);
    });

    if (matching.length === 0) {
      throw new Error(
        `No forecast data available for ${targetDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}. It may be outside the forecast window.`,
      );
    }

    return matching;
  }

  private async getAlertsFromWeatherApi(
    location: string,
    geo: GeocodedLocation,
  ): Promise<GetAlertsResponse> {
    if (!this.weatherApiAccessor) {
      throw new Error(
        "International locations require a WeatherAPI.com key. Set the WEATHERAPI_KEY environment variable.",
      );
    }

    const result = await this.weatherApiAccessor.getForecast(location);
    return {
      location: geo,
      alerts: result.alerts,
      provider: "weatherapi",
    };
  }
}
