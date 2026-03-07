export interface GeocodedLocation {
  lat: number;
  lon: number;
  displayName: string;
  isUS: boolean;
}

export interface CurrentConditions {
  temperature: number;
  temperatureC: number;
  feelsLike: number;
  feelsLikeC: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  description: string;
}

export interface ForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  shortForecast: string;
  detailedForecast: string;
  windSpeed: string;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  headline: string;
  description: string;
  expires: string;
  senderName: string;
}

export interface GetWeatherRequest {
  location: string;
}

export interface GetWeatherResponse {
  location: GeocodedLocation;
  current: CurrentConditions;
  forecast: ForecastPeriod[];
  alerts: WeatherAlert[];
  forecastUrl: string;
  provider: "nws" | "weatherapi";
}

export interface GetAlertsRequest {
  location: string;
}

export interface GetAlertsResponse {
  location: GeocodedLocation;
  alerts: WeatherAlert[];
  provider: "nws" | "weatherapi";
}
