import type { Command } from "../types/command.js";
import ping from "./ping.js";
import purge from "./purge.js";

const commands: Command[] = [ping, purge];

export default commands;
