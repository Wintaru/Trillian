import { eq, lte } from "drizzle-orm";
import { db } from "./database.js";
import { postedWeatherAlerts } from "../db/schema.js";

export class WeatherAlertAccessor {
  async hasBeenPosted(alertId: string): Promise<boolean> {
    const rows = await db
      .select({ id: postedWeatherAlerts.id })
      .from(postedWeatherAlerts)
      .where(eq(postedWeatherAlerts.alertId, alertId))
      .limit(1);
    return rows.length > 0;
  }

  async markPosted(alertId: string, channelId: string): Promise<void> {
    await db.insert(postedWeatherAlerts).values({
      alertId,
      channelId,
      postedAt: Date.now(),
    });
  }

  async pruneOldAlerts(olderThanMs: number): Promise<void> {
    const cutoff = Date.now() - olderThanMs;
    await db
      .delete(postedWeatherAlerts)
      .where(lte(postedWeatherAlerts.postedAt, cutoff));
  }
}
