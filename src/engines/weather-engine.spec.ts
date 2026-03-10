import { describe, it, expect, vi, beforeEach } from "vitest";
import { WeatherEngine } from "./weather-engine.js";
import type { NwsAccessor } from "../accessors/nws-accessor.js";
import type { WeatherApiAccessor } from "../accessors/weatherapi-accessor.js";
import type {
  GeocodedLocation,
  CurrentConditions,
  ForecastPeriod,
  WeatherAlert,
} from "../types/weather-contracts.js";

function createMockNwsAccessor(): NwsAccessor {
  return {
    geocode: vi.fn(),
    getPointMetadata: vi.fn(),
    getForecast: vi.fn(),
    getCurrentObservation: vi.fn(),
    getActiveAlerts: vi.fn(),
  } as unknown as NwsAccessor;
}

function createMockWeatherApiAccessor(): WeatherApiAccessor {
  return {
    getForecast: vi.fn(),
  } as unknown as WeatherApiAccessor;
}

const usLocation: GeocodedLocation = {
  lat: 41.8781,
  lon: -87.6298,
  displayName: "Chicago, Cook County, Illinois, United States",
  isUS: true,
};

const intlLocation: GeocodedLocation = {
  lat: 37.5665,
  lon: 126.978,
  displayName: "Seoul, South Korea",
  isUS: false,
};

const mockCurrent: CurrentConditions = {
  temperature: 72,
  temperatureC: 22,
  feelsLike: 70,
  feelsLikeC: 21,
  humidity: 55,
  windSpeed: 10,
  windDirection: "NW",
  description: "Partly Cloudy",
};

const mockForecast: ForecastPeriod[] = [
  {
    name: "Today",
    startTime: "2026-03-10T06:00:00-05:00",
    temperature: 75,
    temperatureUnit: "F",
    shortForecast: "Partly Cloudy",
    detailedForecast: "Partly cloudy with a high of 75.",
    windSpeed: "10 mph",
  },
  {
    name: "Tonight",
    startTime: "2026-03-10T18:00:00-05:00",
    temperature: 55,
    temperatureUnit: "F",
    shortForecast: "Clear",
    detailedForecast: "Clear skies overnight.",
    windSpeed: "5 mph",
  },
  {
    name: "Wednesday",
    startTime: "2026-03-11T06:00:00-05:00",
    temperature: 70,
    temperatureUnit: "F",
    shortForecast: "Sunny",
    detailedForecast: "Sunny with a high near 70.",
    windSpeed: "8 mph",
  },
];

const mockAlerts: WeatherAlert[] = [];

describe("WeatherEngine", () => {
  let nws: NwsAccessor;
  let weatherApi: WeatherApiAccessor;
  let engine: WeatherEngine;

  beforeEach(() => {
    nws = createMockNwsAccessor();
    weatherApi = createMockWeatherApiAccessor();
    engine = new WeatherEngine(nws, weatherApi);
  });

  describe("getWeather", () => {
    it("should use NWS for US locations", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getPointMetadata).mockResolvedValue({
        properties: {
          forecast: "https://api.weather.gov/gridpoints/LOT/75,73/forecast",
          forecastGridData: "",
          observationStations: "https://api.weather.gov/gridpoints/LOT/75,73/stations",
          county: "",
        },
      });
      vi.mocked(nws.getForecast).mockResolvedValue(mockForecast);
      vi.mocked(nws.getCurrentObservation).mockResolvedValue(mockCurrent);
      vi.mocked(nws.getActiveAlerts).mockResolvedValue(mockAlerts);

      const result = await engine.getWeather({ location: "Chicago, IL" });

      expect(result.provider).toBe("nws");
      expect(result.current.temperature).toBe(72);
      expect(result.forecast).toEqual(mockForecast);
      expect(result.forecastUrl).toContain("forecast.weather.gov");
      expect(weatherApi.getForecast).not.toHaveBeenCalled();
    });

    it("should use WeatherAPI for international locations", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(intlLocation);
      vi.mocked(weatherApi.getForecast).mockResolvedValue({
        location: intlLocation,
        current: mockCurrent,
        forecast: mockForecast,
        alerts: mockAlerts,
        forecastUrl: "https://www.weatherapi.com/weather/q/37.5665%2C126.978",
      });

      const result = await engine.getWeather({ location: "Seoul, Korea" });

      expect(result.provider).toBe("weatherapi");
      expect(result.location.isUS).toBe(false);
      expect(nws.getPointMetadata).not.toHaveBeenCalled();
    });

    it("should fall back to WeatherAPI when NWS fails for US locations", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getPointMetadata).mockRejectedValue(new Error("NWS 500"));
      vi.mocked(weatherApi.getForecast).mockResolvedValue({
        location: usLocation,
        current: mockCurrent,
        forecast: mockForecast,
        alerts: mockAlerts,
        forecastUrl: "https://www.weatherapi.com/weather/q/41.8781%2C-87.6298",
      });

      const result = await engine.getWeather({ location: "Chicago, IL" });

      expect(result.provider).toBe("weatherapi");
    });

    it("should throw if international location and no WeatherAPI key", async () => {
      const engineNoApi = new WeatherEngine(nws, null);
      vi.mocked(nws.geocode).mockResolvedValue(intlLocation);

      await expect(
        engineNoApi.getWeather({ location: "Seoul, Korea" }),
      ).rejects.toThrow("WEATHERAPI_KEY");
    });

    it("should fall back to WeatherAPI geocoding when Nominatim fails", async () => {
      vi.mocked(nws.geocode).mockRejectedValue(new Error("Nominatim timeout"));
      vi.mocked(weatherApi.getForecast).mockResolvedValue({
        location: usLocation,
        current: mockCurrent,
        forecast: mockForecast,
        alerts: mockAlerts,
        forecastUrl: "https://www.weatherapi.com/weather/q/41.8781%2C-87.6298",
      });
      vi.mocked(nws.getPointMetadata).mockResolvedValue({
        properties: {
          forecast: "https://api.weather.gov/gridpoints/LOT/75,73/forecast",
          forecastGridData: "",
          observationStations: "https://api.weather.gov/gridpoints/LOT/75,73/stations",
          county: "",
        },
      });
      vi.mocked(nws.getForecast).mockResolvedValue(mockForecast);
      vi.mocked(nws.getCurrentObservation).mockResolvedValue(mockCurrent);
      vi.mocked(nws.getActiveAlerts).mockResolvedValue(mockAlerts);

      const result = await engine.getWeather({ location: "Chicago, IL" });

      // Should still use NWS for the forecast since usLocation.isUS = true
      expect(result.provider).toBe("nws");
    });

    it("should throw if no location provided", async () => {
      await expect(engine.getWeather({ location: "" })).rejects.toThrow(
        "No location provided",
      );
    });

    it("should filter forecast by target date", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getPointMetadata).mockResolvedValue({
        properties: {
          forecast: "https://api.weather.gov/gridpoints/LOT/75,73/forecast",
          forecastGridData: "",
          observationStations: "https://api.weather.gov/gridpoints/LOT/75,73/stations",
          county: "",
        },
      });
      vi.mocked(nws.getForecast).mockResolvedValue(mockForecast);
      vi.mocked(nws.getCurrentObservation).mockResolvedValue(mockCurrent);
      vi.mocked(nws.getActiveAlerts).mockResolvedValue([]);

      const targetDate = new Date(2026, 2, 10); // March 10, 2026
      const result = await engine.getWeather({ location: "Chicago, IL", targetDate });

      expect(result.targetDate).toEqual(targetDate);
      // Should only include periods matching 2026-03-10
      expect(result.forecast.every((p) => p.startTime.startsWith("2026-03-10"))).toBe(true);
      expect(result.forecast).toHaveLength(2); // Today + Tonight
    });

    it("should throw for past target dates", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);

      const pastDate = new Date(2020, 0, 1);
      await expect(
        engine.getWeather({ location: "Chicago, IL", targetDate: pastDate }),
      ).rejects.toThrow("past dates");
    });

    it("should throw for dates beyond the forecast window", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);

      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 30);
      await expect(
        engine.getWeather({ location: "Chicago, IL", targetDate: farFuture }),
      ).rejects.toThrow("too far out");
    });

    it("should re-validate date against WeatherAPI limit when NWS fails", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getPointMetadata).mockRejectedValue(new Error("NWS down"));

      const fiveDaysOut = new Date();
      fiveDaysOut.setDate(fiveDaysOut.getDate() + 5);
      await expect(
        engine.getWeather({ location: "Chicago, IL", targetDate: fiveDaysOut }),
      ).rejects.toThrow("too far out");
    });

    it("should throw a friendly message for international locations beyond 3 days", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(intlLocation);

      const fourDaysOut = new Date();
      fourDaysOut.setDate(fourDaysOut.getDate() + 4);
      await expect(
        engine.getWeather({ location: "Seoul, Korea", targetDate: fourDaysOut }),
      ).rejects.toThrow("too far out");
    });
  });

  describe("getAlerts", () => {
    it("should use NWS for US locations", async () => {
      const alerts: WeatherAlert[] = [
        {
          id: "urn:oid:2.49.0.1.840.0.1",
          event: "Heat Advisory",
          severity: "Moderate",
          headline: "Heat Advisory until 8 PM",
          description: "Hot temperatures expected.",
          expires: "2026-03-07T20:00:00-05:00",
          senderName: "NWS Chicago",
        },
      ];

      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getActiveAlerts).mockResolvedValue(alerts);

      const result = await engine.getAlerts({ location: "Chicago, IL" });

      expect(result.provider).toBe("nws");
      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].event).toBe("Heat Advisory");
    });

    it("should return empty alerts when none active", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getActiveAlerts).mockResolvedValue([]);

      const result = await engine.getAlerts({ location: "Chicago, IL" });

      expect(result.alerts).toHaveLength(0);
    });

    it("should fall back to WeatherAPI for alerts when NWS fails", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getActiveAlerts).mockRejectedValue(new Error("NWS down"));
      vi.mocked(weatherApi.getForecast).mockResolvedValue({
        location: usLocation,
        current: mockCurrent,
        forecast: mockForecast,
        alerts: [],
        forecastUrl: "https://www.weatherapi.com/weather/q/41.8781%2C-87.6298",
      });

      const result = await engine.getAlerts({ location: "Chicago, IL" });

      expect(result.provider).toBe("weatherapi");
    });

    it("should only geocode once for repeated calls with the same location", async () => {
      vi.mocked(nws.geocode).mockResolvedValue(usLocation);
      vi.mocked(nws.getActiveAlerts).mockResolvedValue([]);

      await engine.getAlerts({ location: "Chicago, IL" });
      await engine.getAlerts({ location: "Chicago, IL" });
      await engine.getAlerts({ location: "Chicago, IL" });

      expect(nws.geocode).toHaveBeenCalledTimes(1);
    });
  });
});
