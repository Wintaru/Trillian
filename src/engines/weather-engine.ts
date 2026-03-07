import type { NwsAccessor } from "../accessors/nws-accessor.js";
import type { WeatherApiAccessor } from "../accessors/weatherapi-accessor.js";
import type {
  GetWeatherRequest,
  GetWeatherResponse,
  GetAlertsRequest,
  GetAlertsResponse,
  GeocodedLocation,
} from "../types/weather-contracts.js";
import * as logger from "../utilities/logger.js";

export class WeatherEngine {
  constructor(
    private nwsAccessor: NwsAccessor,
    private weatherApiAccessor: WeatherApiAccessor | null,
  ) {}

  async getWeather(request: GetWeatherRequest): Promise<GetWeatherResponse> {
    if (!request.location) {
      throw new Error("No location provided. Set WEATHER_LOCATION or pass a location.");
    }

    const geo = await this.nwsAccessor.geocode(request.location);

    if (geo.isUS) {
      try {
        return await this.getWeatherFromNws(geo);
      } catch (err) {
        logger.warn(`NWS failed for ${geo.displayName}, trying WeatherAPI fallback:`, err);
        return this.getWeatherFromWeatherApi(request.location);
      }
    }

    return this.getWeatherFromWeatherApi(request.location);
  }

  async getAlerts(request: GetAlertsRequest): Promise<GetAlertsResponse> {
    if (!request.location) {
      throw new Error("No location provided.");
    }

    const geo = await this.nwsAccessor.geocode(request.location);

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
