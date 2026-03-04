import type { EventHandler } from "../types/event.js";
import ready from "./ready.js";

const events: EventHandler[] = [ready];

export default events;
