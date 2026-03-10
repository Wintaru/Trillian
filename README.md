# Discord Bot

A Discord bot built with TypeScript, discord.js v14, and SQLite.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/)
- [Ollama](https://ollama.ai/) (for AI chat feature)

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application** and give it a name
3. Go to the **Bot** tab and click **Reset Token** to get your bot token
4. Under **Privileged Gateway Intents**, enable **Message Content Intent** and **Server Members Intent**
5. Go to the **OAuth2** tab, select the **bot** and **applications.commands** scopes
6. Under **Bot Permissions**, select the permissions your bot needs (at minimum: Send Messages, Manage Messages, Read Message History)
7. Copy the generated URL and open it in your browser to invite the bot to your server

## Installation

```bash
pnpm install
```

## Configuration

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DISCORD_TOKEN` | Your bot token from the Developer Portal |
| `DISCORD_CLIENT_ID` | Your application's Client ID (found on the General Information page) |
| `DISCORD_GUILD_ID` | The ID of your development server (right-click server name > Copy Server ID) |
| `BOT_PREFIX` | Prefix for text commands (default: `!`) |
| `PURGE_CHANNEL_IDS` | Comma-separated channel IDs where `/purge` is allowed (e.g., `123456,789012`) |
| `XP_COOLDOWN_SECONDS` | Seconds between XP awards per user (default: `60`) |
| `XP_MIN` | Minimum XP per message (default: `15`) |
| `XP_MAX` | Maximum XP per message (default: `25`) |
| `LEVELUP_CHANNEL_ID` | Channel for level-up announcements (default: same channel as message) |
| `OLLAMA_URL` | Ollama API URL (default: `http://localhost:11434`) |
| `OLLAMA_MODEL` | Ollama model for chat responses (default: `mistral-nemo:12b`) |
| `OLLAMA_CONTEXT_MESSAGES` | Number of recent channel messages to include as conversation context (default: `10`) |
| `CAMPAIGN_CHANNEL_ID` | Channel ID where Shadowrun campaigns run (required for campaign system) |
| `OLLAMA_GM_TIMEOUT_MS` | Timeout for Ollama GM narrative generation in milliseconds (default: `120000`) |
| `WEATHER_CHANNEL_ID` | Channel ID for scheduled weather posts (daily forecast + alerts) |
| `WEATHER_LOCATION` | Default location for scheduled posts and `/weather` with no args (e.g., `90210` or `Chicago, IL`) |
| `WEATHER_DAILY_TIME` | Time to post daily forecast in 24h format (default: `07:00`) |
| `WEATHERAPI_KEY` | API key from [WeatherAPI.com](https://www.weatherapi.com/) — required for international locations |
| `WEATHER_ALERT_INTERVAL_MS` | How often to check for weather alerts in milliseconds (default: `300000` / 5 minutes) |
| `ANNOUNCE_CHANNEL_ID` | Channel where the bot posts a message when it comes online (optional — no announcement if unset) |

## Running

```bash
# Development (auto-restarts on changes)
pnpm dev

# Production
pnpm build
pnpm start
```

## Deploying Slash Commands

Slash commands must be registered with Discord before they appear. Run this after adding or changing commands:

```bash
pnpm deploy-commands
```

This registers commands to your development guild (instant). For global deployment, modify `scripts/deploy-commands.ts` to use `Routes.applicationCommands()` instead.

## Commands

| Command | Description | Permission |
|---|---|---|
| `/ping` | Replies with Pong! | Everyone |
| `/purge [count]` | Delete messages from a configured channel | Manage Messages |
| `/rank [@user]` | Show level, XP, rank, and progress | Everyone |
| `/leaderboard [page]` | Show the server XP leaderboard | Everyone |
| `/xp set @user <amount>` | Set a user's XP | Manage Server |
| `/xp add @user <amount>` | Add XP to a user | Manage Server |
| `/xp reset @user` | Reset a user's XP to zero | Manage Server |
| `/poll` | Create an anonymous poll | Everyone |
| `/embed create` | Open the embed builder wizard | Manage Messages |
| `/embed edit <message_id> [channel]` | Edit an existing bot-posted embed | Manage Messages |
| `/embed template list` | List your saved embed templates | Manage Messages |
| `/embed template load <name>` | Load a template into the builder | Manage Messages |
| `/embed template delete <name>` | Delete a saved template | Manage Messages |
| `/campaign start [premise]` | Start a new Shadowrun campaign | Everyone |
| `/campaign stop` | End the active campaign | Campaign GM / Admin |
| `/campaign pause` | Pause the active campaign | Campaign GM / Admin |
| `/campaign resume` | Resume a paused campaign | Campaign GM / Admin |
| `/campaign status` | Show campaign overview | Everyone |
| `/campaign addplayer @user` | Add a player and start character creation | Campaign GM / Admin |
| `/campaign removeplayer @user` | Remove a player from the campaign | Campaign GM / Admin |
| `/campaign players` | List players and character statuses | Everyone |
| `/campaign summon @user` | Ping an absent player | Everyone |
| `/campaign recap` | AI-generated "story so far" summary | Everyone |
| `/campaign history` | List past campaigns in the server | Everyone |
| `/character create <name>` | Create a new Shadowrun character (DM wizard) | Everyone |
| `/character sheet [@user]` | View a character sheet | Everyone |
| `/character delete <name>` | Delete an unlinked character | Everyone |
| `/character edit <name> <step>` | Reopen a creation step on a completed character | Everyone |
| `/character cancel` | Cancel in-progress character creation | Everyone |
| `/roll <pool> [limit] [description]` | Roll a Shadowrun dice pool | Everyone |
| `/roll edge <pool> <edge_dice>` | Push the Limit roll | Everyone |
| `/shadowrun info <topic>` | Look up Shadowrun game info | Everyone |
| `/weather [location]` | Get current weather and forecast | Everyone |
| `/define <word>` | Look up the definition of an English word | Everyone |

All commands support both slash (`/command`) and prefix (`!command`) invocation.

---

## Command Reference

### `/ping`

A simple health check command. Replies with "Pong!" to confirm the bot is online and responsive.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/ping` |
| Prefix command | `!ping` |

#### Parameters

None.

#### Permission

Everyone — no special permissions required.

#### Configuration

None — works out of the box.

#### Bot Permissions Required

- Send Messages

---

### `/purge`

Bulk-deletes messages from the current channel. Restricted to specific channels to prevent accidental wipes.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/purge` or `/purge count:50` |
| Prefix command | `!purge` or `!purge 50` |

#### Parameters

| Parameter | Type | Required | Default | Range | Description |
|---|---|---|---|---|---|
| `count` | Integer | No | 100 | 1–1000 | Number of messages to delete |

#### Permission

Manage Messages — users without this permission cannot see or use the command. For slash commands, Discord enforces this automatically. For prefix commands, the bot checks the user's permissions before executing.

#### Configuration

| Env Variable | Required | Example | Description |
|---|---|---|---|
| `PURGE_CHANNEL_IDS` | Yes | `123456789,987654321` | Comma-separated list of channel IDs where purge is allowed. If empty or unset, purge is blocked in all channels. |

**How to get a channel ID:** Right-click any channel name in Discord > **Copy Channel ID**. If you don't see this option, go to **User Settings** > **Advanced** > enable **Developer Mode**.

**Setup steps:**

1. Copy the channel ID(s) you want to allow purging in
2. Add them to your `.env` file:
   ```
   PURGE_CHANNEL_IDS=123456789,987654321
   ```
3. Restart the bot

#### Bot Permissions Required

- Send Messages
- Manage Messages
- Read Message History

#### Behavior

1. Bot fetches messages in batches of up to 100
2. Each batch is bulk-deleted via the Discord API
3. Bot continues until the requested count is reached or no more messages remain
4. Bot replies with a summary: how many deleted, how many skipped, any errors

#### Limitations

| Limitation | Detail |
|---|---|
| **14-day cutoff** | Discord's bulk delete API silently skips messages older than 14 days. These are reported as "skipped" in the response. The bot does not fall back to individual deletes for old messages. |
| **Rate limits** | Discord rate-limits bulk delete to ~1 request per second per channel. A 1000-message purge takes at least ~10 seconds. |
| **Pinned messages** | Pinned messages are deleted along with everything else. They are not filtered out. |
| **No undo** | Deleted messages cannot be recovered by any means. |
| **Audit log** | All bulk deletes appear in the server's audit log attributed to the bot. |

---

### `/rank`

Shows a user's current level, XP, named rank, and progress toward the next level.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/rank` or `/rank user:@someone` |
| Prefix command | `!rank` or `!rank @someone` |

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `user` | User | No | User to check (defaults to you) |

#### Permission

Everyone — no special permissions required.

---

### `/leaderboard`

Shows the server XP leaderboard, paginated with 10 members per page.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/leaderboard` or `/leaderboard page:2` |
| Prefix command | `!leaderboard` or `!leaderboard 2` |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` | Integer | No | 1 | Page number |

#### Permission

Everyone — no special permissions required.

---

### `/xp`

Admin commands for managing user XP. Has three subcommands: `set`, `add`, and `reset`.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/xp set user:@someone amount:500` |
| Slash command | `/xp add user:@someone amount:100` |
| Slash command | `/xp reset user:@someone` |
| Prefix command | `!xp set @someone 500` |
| Prefix command | `!xp add @someone 100` |
| Prefix command | `!xp reset @someone` |

#### Permission

Manage Server — users without this permission cannot see or use the command.

---

### `/poll`

Create an anonymous poll. Votes are stored in the database and never publicly revealed — only aggregate counts are shown. Users vote by clicking buttons, and the bot confirms their vote with an ephemeral message only they can see.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/poll question:"What's for lunch?" options:"Pizza, Burgers, Salad"` |
| Slash command (timed) | `/poll question:"Movie night pick?" options:"Action, Comedy, Horror" duration:60` |
| Prefix command | `!poll "What's for lunch?" "Pizza, Burgers, Salad"` |
| Prefix command (timed) | `!poll "Movie night pick?" "Action, Comedy, Horror" 60` |

#### Parameters

| Parameter | Type | Required | Default | Range | Description |
|---|---|---|---|---|---|
| `question` | String | Yes | — | Max 256 chars | The poll question |
| `options` | String | Yes | — | 2–10 items | Comma-separated list of choices |
| `duration` | Integer | No | 480 (8 hours) | 1–10080 | Auto-close timer in minutes (max 7 days) |

#### Permission

Everyone — anyone can create a poll. Only the poll creator or server administrators can close it.

#### Configuration

None — works out of the box.

#### Bot Permissions Required

- Send Messages
- Embed Links
- Read Message History

#### Behavior

1. Bot creates an embed showing the question, options (with vote bars), and poll status
2. Each option has a button. Users click to vote — the bot replies ephemerally confirming their vote
3. Vote counts update live on the embed after each vote
4. Users can change their vote by clicking a different option button
5. The poll creator (or an admin) can click the "Close Poll" button to end voting
6. If a duration was set, the poll auto-closes when the timer expires
7. When closed, buttons are removed and the embed shows final results

#### Limitations

| Limitation | Detail |
|---|---|
| **Max 10 options** | Discord allows at most 5 buttons per row. Polls with 6+ options use two rows. |
| **Timers don't survive restarts** | If the bot restarts, expired polls are caught and closed on the next 30-second check cycle. |
| **No undo** | Votes are irreversibly anonymous — there is no audit trail by design. |
| **One vote per user** | Each user can only vote for one option. Clicking a different option changes their vote. |

---

### `/embed`

Create, edit, and manage rich Discord embeds through an interactive button-based wizard with live preview. Supports saveable templates and editing previously posted embeds.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/embed create` |
| Slash command | `/embed edit message_id:123456789` |
| Slash command | `/embed edit message_id:123456789 channel:#announcements` |
| Slash command | `/embed template list` |
| Slash command | `/embed template load name:my-announcement` |
| Slash command | `/embed template delete name:my-announcement` |
| Prefix command | `!embed` (redirects to slash command) |

#### Parameters

| Subcommand | Parameter | Type | Required | Description |
|---|---|---|---|---|
| `create` | — | — | — | Opens a blank embed builder wizard |
| `edit` | `message_id` | String | Yes | The message ID of the bot-posted embed to edit |
| `edit` | `channel` | Channel | No | Channel the message is in (defaults to current channel) |
| `template list` | — | — | — | Lists your saved templates |
| `template load` | `name` | String | Yes | Name of the template to load |
| `template delete` | `name` | String | Yes | Name of the template to delete |

#### Permission

Manage Messages — users without this permission cannot see or use the command. For slash commands, Discord enforces this automatically. Prefix invocation redirects to the slash command.

#### Configuration

None — works out of the box.

#### Bot Permissions Required

- Send Messages
- Embed Links
- Read Message History (for editing existing embeds)

#### Behavior

1. **Create:** `/embed create` opens an ephemeral message with an empty embed preview and wizard buttons
2. **Wizard buttons:** Set Title, Set Description, Set Color, Add Field, Set Image, Set Footer, Set Author — each opens a modal form for that field
3. **Live preview:** The embed preview updates after each modal submission so you can see your changes immediately
4. **Send:** Click "Send to Channel" and provide a channel ID — the bot sends the finished embed to that channel
5. **Save Template:** Click "Save Template" to save the current embed as a reusable template (up to 25 per user per server)
6. **Cancel:** Click "Cancel" to discard the embed and close the wizard
7. **Edit:** `/embed edit` fetches an existing bot-posted message, extracts its embed data, and opens the wizard pre-populated. When sent, the original message is edited in place.
8. **Templates:** `/embed template load` opens the wizard pre-populated from a saved template. `/embed template list` shows all your templates. `/embed template delete` removes one.

#### Limitations

| Limitation | Detail |
|---|---|
| **Slash only** | The interactive wizard requires Discord components (buttons/modals) which only work with slash commands. Prefix invocation displays a redirect message. |
| **Ephemeral wizard** | The wizard is only visible to you. It expires after 15 minutes of inactivity. |
| **Max 25 fields** | Discord embeds support up to 25 fields. The "Add Field" button is disabled at the limit. |
| **Max 25 templates** | Each user can save up to 25 templates per server. |
| **Bot messages only** | `/embed edit` can only edit messages posted by the bot. |
| **Channel ID input** | The "Send to Channel" modal requires a channel ID or `#channel` mention — there is no channel picker dropdown. |

---

### `/campaign`

Manage Shadowrun 5th Edition campaigns. The bot acts as Game Master using Ollama for narrative generation. Only one active campaign is allowed per server at a time.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/campaign start premise:Corporate data heist in Redmond` |
| Slash command | `/campaign stop` |
| Slash command | `/campaign pause` |
| Slash command | `/campaign resume` |
| Slash command | `/campaign status` |
| Slash command | `/campaign addplayer user:@someone` |
| Slash command | `/campaign removeplayer user:@someone` |
| Slash command | `/campaign players` |
| Slash command | `/campaign summon user:@someone` |
| Slash command | `/campaign recap` |
| Slash command | `/campaign history` |
| Prefix command | `!campaign start Corporate data heist in Redmond` |
| Prefix command | `!campaign addplayer @someone` |

#### Parameters

| Subcommand | Parameter | Type | Required | Description |
|---|---|---|---|---|
| `start` | `premise` | String | No | Optional premise for the campaign setting |
| `addplayer` | `user` | User | Yes | Player to add to the campaign |
| `removeplayer` | `user` | User | Yes | Player to remove from the campaign |
| `summon` | `user` | User | Yes | Player to ping |

#### Permission

- `start`, `status`, `players`, `summon`, `recap`, `history` — Everyone
- `stop`, `pause`, `resume`, `addplayer`, `removeplayer` — Campaign GM (who started it) or users with Manage Server permission

#### Configuration

| Env Variable | Required | Example | Description |
|---|---|---|---|
| `CAMPAIGN_CHANNEL_ID` | Yes | `123456789` | Channel ID where campaigns run. All campaign interactions happen here. |
| `OLLAMA_GM_TIMEOUT_MS` | No | `120000` | Timeout for Ollama narrative generation (default: 120000ms / 2 minutes) |

**Setup steps:**

1. Create or choose a text channel for campaigns
2. Copy the channel ID (right-click > Copy Channel ID)
3. Add to `.env`:
   ```
   CAMPAIGN_CHANNEL_ID=123456789
   ```
4. Restart the bot

#### Bot Permissions Required

- Send Messages
- Embed Links
- Read Message History

#### Behavior

1. **Starting a campaign:** `/campaign start` sends the premise to Ollama which generates a campaign name, setting, objective, location, and opening narrative. This may take up to 2 minutes.
2. **Advancing the story:** @mention the bot in the campaign channel. The bot reads all messages since the last ping, feeds them to Ollama as player actions, and generates the next narrative beat. If the AI calls for skill checks, dice are auto-rolled.
3. **Adding players:** `/campaign addplayer @user` adds a player and DMs them to start character creation (see `/character` below).
4. **Recap:** `/campaign recap` sends the full narrative log to Ollama for a cohesive story summary — useful after long breaks.
5. **History:** `/campaign history` lists all past campaigns with brief summaries.

#### Limitations

| Limitation | Detail |
|---|---|
| **One campaign at a time** | A server can only have one active or paused campaign. Stop or complete the current one before starting another. |
| **Configured channel only** | Campaign commands and ping-to-advance only work in the channel specified by `CAMPAIGN_CHANNEL_ID`. |
| **AI generation time** | Starting a campaign and advancing narrative depend on Ollama response time, which can take up to 2 minutes. |
| **Narrative length** | AI responses are capped at ~1800 characters to fit Discord's message limits. |

---

### `/character`

Create and view Shadowrun characters. Characters can be created independently of campaigns — when a player is later added to a campaign, their most recent unassigned character is automatically linked.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/character create name:Razor` |
| Slash command | `/character sheet` |
| Slash command | `/character sheet user:@someone` |
| Slash command | `/character delete name:Razor` |
| Slash command | `/character edit name:Razor step:skills` |
| Slash command | `/character cancel` |
| Prefix command | `!character create Razor` |
| Prefix command | `!character sheet` |
| Prefix command | `!character sheet @someone` |
| Prefix command | `!character delete Razor` |
| Prefix command | `!character edit Razor skills` |
| Prefix command | `!character cancel` |

#### Parameters

| Subcommand | Parameter | Type | Required | Description |
|---|---|---|---|---|
| `create` | `name` | String | Yes | Name for the new character |
| `sheet` | `user` | User | No | View another player's character (public summary). Defaults to your own (full private sheet). |
| `delete` | `name` | String | Yes | Name of the character to delete. Cannot delete campaign-linked characters. |
| `edit` | `name` | String | Yes | Name of the completed character to edit |
| `edit` | `step` | String (choice) | Yes | Step to reopen: metatype, archetype, attributes, skills, qualities, magic, gear, contacts, backstory |
| `cancel` | — | — | — | Cancels your current in-progress character creation and deletes the partial character. |

#### Permission

Everyone — no special permissions required.

#### Configuration

- `create` — Works anywhere. No campaign required. Starts a DM wizard.
- `sheet` — Requires an active or paused campaign in the current channel (uses `CAMPAIGN_CHANNEL_ID`).

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. **Create:** Starts a step-by-step character creation wizard in your DMs. Walk through metatype, archetype, attributes, skills, qualities, magic, gear, contacts, and backstory. The character is saved without a campaign — when you're later added to a campaign via `/campaign addplayer`, it's automatically linked.
2. **Sheet (own character):** Shows a detailed embed (ephemeral in slash, DM'd in prefix) with all attributes, skills, gear, spells, contacts, condition monitors, nuyen, karma, and backstory.
3. **Sheet (other player):** Shows a public embed with name, metatype, archetype, key attributes, and a brief skills/gear summary.
4. **Delete:** Permanently deletes a character you own, as long as it's not linked to a campaign.
5. **Edit:** Reopens a specific creation step on a completed (non-campaign-linked) character. The DM wizard resumes from that step; after completing it, you'll proceed through review again.
6. **Cancel:** Cancels your in-progress character creation and deletes the partial character entirely.
7. Only completed characters are shown — in-progress character creation is not viewable.

#### Limitations

| Limitation | Detail |
|---|---|
| **Sheet requires campaign** | `/character sheet` only works in the campaign channel with an active/paused campaign. |
| **One creation at a time** | If you have an in-progress character, starting a new one resumes the existing creation. Use `/character cancel` to abort. |
| **Completed characters only** | Characters still in creation are not viewable via `sheet`. |
| **Cannot delete campaign characters** | Characters linked to a campaign must be removed from the campaign first. |
| **Edit reopens DM wizard** | Editing a step puts the character back in "in progress" state until you complete the review step again. |
| **Auto-link uses most recent** | When added to a campaign, the most recently created unassigned character is linked. Future updates will add character selection. |

---

### `/roll`

Roll Shadowrun 5E dice pools. Rolls a number of d6s, counting 5s and 6s as hits. Detects glitches (more than half are 1s) and critical glitches (glitch with zero hits).

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/roll pool:8 limit:6 description:Firearms + Agility` |
| Slash command | `/roll edge pool:8 edge_dice:3` |
| Prefix command | `!roll 8 6 Firearms + Agility` |
| Prefix command | `!roll edge 8 3` |

#### Parameters

**Standard roll:**

| Parameter | Type | Required | Default | Range | Description |
|---|---|---|---|---|---|
| `pool` | Integer | Yes | — | 1–50 | Number of d6s to roll |
| `limit` | Integer | No | None | 1–50 | Maximum hits (excess hits are discarded) |
| `description` | String | No | None | — | Label for the roll |

**Push the Limit (edge) roll:**

| Parameter | Type | Required | Range | Description |
|---|---|---|---|---|
| `pool` | Integer | Yes | 1–50 | Base dice pool |
| `edge_dice` | Integer | Yes | 1–20 | Extra Edge dice to add (no limit applied) |

#### Permission

Everyone — no special permissions required.

#### Configuration

None — works out of the box. No campaign required.

#### Bot Permissions Required

- Send Messages

#### Behavior

1. Rolls the specified number of d6s
2. Counts hits (5s and 6s)
3. If a limit is set, excess hits are discarded
4. Checks for glitch (more than half of all dice are 1s) and critical glitch (glitch + zero hits)
5. Displays each die result, total hits, and any glitch/critical glitch warnings

#### Limitations

| Limitation | Detail |
|---|---|
| **Max 50 dice** | Pool size capped at 50 to prevent excessively long output. |
| **No Rule of Six** | The "Rule of Six" (exploding 6s) is not implemented for standard rolls — only Push the Limit ignores limits. |

---

### `/shadowrun info`

Look up Shadowrun 5E game information. Covers metatypes, archetypes, skills, lifestyles, dice mechanics, combat, magic, and the Matrix. For known topics, displays static reference data instantly. For other topics, queries Ollama for a lore-based answer.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/shadowrun info topic:metatypes` |
| Slash command | `/shadowrun info topic:combat` |
| Prefix command | `!shadowrun info metatypes` |
| Prefix command | `!shadowrun info magic` |

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `topic` | String | Yes | Topic to look up. Built-in topics: `metatypes`, `archetypes`, `skills`, `lifestyles`, `dice`, `combat`, `magic`, `matrix`. Aliases like `classes`, `races`, `hacking` also work. Any other topic queries Ollama. |

#### Permission

Everyone — no special permissions required. Slash command replies are ephemeral (only visible to the user).

#### Configuration

None for built-in topics. Ollama must be running for custom topic queries.

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. Checks if the topic matches a built-in category or alias
2. If matched: returns a pre-formatted embed with game reference data
3. If not matched: sends the topic to Ollama with a Shadowrun lore prompt and returns the AI response
4. Slash command responses are ephemeral to avoid cluttering the channel

#### Limitations

| Limitation | Detail |
|---|---|
| **AI fallback** | Custom topics require Ollama to be running. If Ollama is down, only built-in topics work. |
| **Response length** | AI responses are truncated to 2000 characters (Discord message limit). |

---

### `/weather`

Get current weather conditions, forecast, and active alerts for a location. US locations use the National Weather Service (free, no API key). International locations use WeatherAPI.com (requires a free API key). Includes a clickable link to the full forecast.

When configured with `WEATHER_CHANNEL_ID` and `WEATHER_LOCATION`, the bot also posts a daily forecast at the configured time and pushes severe weather alerts as they are issued.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/weather` |
| Slash command | `/weather location:Chicago, IL` |
| Slash command | `/weather location:90210` |
| Slash command | `/weather location:Seoul, Korea` |
| Prefix command | `!weather` |
| Prefix command | `!weather Chicago, IL` |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `location` | String | No | `WEATHER_LOCATION` env var | Location to look up. Accepts zip codes, city names, or "City, Country" format. |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Env Variable | Required | Example | Description |
|---|---|---|---|
| `WEATHER_LOCATION` | No | `Chicago, IL` | Default location for `/weather` with no args and for scheduled posts |
| `WEATHER_CHANNEL_ID` | No | `123456789` | Channel for scheduled daily forecasts and weather alerts |
| `WEATHER_DAILY_TIME` | No | `07:00` | Time to post the daily forecast (24h format, server local time). Default: `07:00` |
| `WEATHERAPI_KEY` | No | `abc123` | API key from WeatherAPI.com. Required only if you want international location support. Get a free key at https://www.weatherapi.com/ |
| `WEATHER_ALERT_INTERVAL_MS` | No | `300000` | Milliseconds between alert checks. Default: `300000` (5 minutes) |

**Setup steps:**

1. Set your default location in `.env`:
   ```
   WEATHER_LOCATION=Chicago, IL
   ```
2. (Optional) For scheduled posts, set the channel:
   ```
   WEATHER_CHANNEL_ID=123456789
   WEATHER_DAILY_TIME=07:00
   ```
3. (Optional) For international locations, get a free API key from https://www.weatherapi.com/ and add it:
   ```
   WEATHERAPI_KEY=your-key-here
   ```
4. Run `pnpm deploy-commands` and restart the bot

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. **On-demand:** User runs `/weather [location]`. If no location is provided, uses the `WEATHER_LOCATION` default.
2. The bot geocodes the location (via OpenStreetMap Nominatim) and determines if it's a US or international location.
3. **US locations:** Fetches current conditions, forecast (6 periods), and active alerts from the National Weather Service API.
4. **International locations:** Fetches weather from WeatherAPI.com (requires `WEATHERAPI_KEY`). If NWS fails for a US location, falls back to WeatherAPI.com.
5. Replies with a rich embed containing current conditions, forecast periods, and a clickable title linking to the full forecast page.
6. If there are active weather alerts, they are displayed as additional embeds (up to 3).
7. **Scheduled daily forecast:** If `WEATHER_CHANNEL_ID` and `WEATHER_LOCATION` are set, the bot posts a daily forecast embed at the configured time.
8. **Scheduled alert checks:** Every 5 minutes (configurable), the bot checks for active weather alerts. New alerts are posted to the weather channel. Previously posted alerts are tracked in the database to avoid duplicates.

#### Limitations

| Limitation | Detail |
|---|---|
| **NWS is US-only** | The National Weather Service API only covers US territories. International locations require a `WEATHERAPI_KEY`. |
| **Geocoding rate limit** | Location geocoding uses OpenStreetMap Nominatim, which has a 1 request/second policy. Fine for a single-server bot. |
| **API latency** | NWS requires multiple API calls (points, forecast, observations, alerts). The slash command uses `deferReply()` to handle this. |
| **Daily time is local** | `WEATHER_DAILY_TIME` uses the server's system timezone, not a user-configured timezone. |
| **Alert dedup** | Posted alerts are tracked for 7 days. Alerts that expire and are reissued after 7 days may be re-posted. |

---

### `/define`

Look up the definition of an English word using the [Free Dictionary API](https://dictionaryapi.dev/). Returns pronunciation, definitions grouped by part of speech, usage examples, and synonyms — no API key required.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/define word:ephemeral` |
| Prefix command | `!define ephemeral` |

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `word` | String | Yes | The English word to look up |

#### Permission

Everyone — no special permissions required.

#### Configuration

None — works out of the box. No API key needed.

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. User provides a word via `/define` or `!define`
2. Bot queries the Free Dictionary API for definitions
3. Bot replies with a rich embed containing:
   - **Title:** The word, linked to its Wiktionary source page
   - **Pronunciation:** Phonetic transcription (e.g., `/ɪˈfɛm.ər.əl/`)
   - **Definitions:** Grouped by part of speech (noun, verb, adjective, etc.), numbered, with up to 3 definitions per group
   - **Examples:** Usage examples shown in italics where available
   - **Synonyms:** Up to 5 synonyms listed per part of speech
4. If the word is not found, replies with a friendly error message

#### Limitations

| Limitation | Detail |
|---|---|
| **English only** | The Free Dictionary API only supports English words. |
| **Single words** | Multi-word phrases and idioms may not return results. |
| **Max 4 parts of speech** | Only the first 4 meanings (noun, verb, etc.) are shown to keep the embed readable. |
| **Max 3 definitions each** | Each part of speech shows up to 3 definitions. |
| **Synonym coverage** | Not all words have synonyms in the API. Coverage varies. |

---

### `/translate`

Translate text between languages using AI (Ollama) with optional DeepL verification. The AI provides a translation plus linguistic notes explaining grammar, vocabulary, and cultural context — ideal for language learners. DeepL serves as a reference translation when configured.

#### Usage

| Invocation | Example |
|---|---|
| Slash command | `/translate text:Where is the train station? to:ES` |
| Slash command (with source) | `/translate text:Bonjour le monde from:FR to:EN` |
| Prefix command | `!translate Where is the train station?` |
| Prefix command (with flags) | `!translate --from FR --to EN Bonjour le monde` |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `text` | String | Yes | — | The text to translate |
| `to` | String | No | `ES` (Spanish) | Target language code (e.g. ES, FR, DE, JA) |
| `from` | String | No | Auto-detect | Source language code (auto-detected if omitted) |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Variable | Required | Description |
|---|---|---|
| `DEEPL_API_KEY` | No | DeepL API key for reference translations. Get a free key at [deepl.com](https://www.deepl.com/pro-api). If omitted, only AI translation is used. |

Ollama must be running (same setup as AI Chat). No additional Ollama configuration needed — uses the same instance and model.

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. User provides text and optionally source/target languages
2. Bot queries Ollama for a translation with linguistic explanation (grammar notes, vocabulary choices, idioms)
3. If a DeepL API key is configured, bot also queries DeepL for a reference translation
4. Both providers run in parallel — if one fails, the other's result is still shown
5. Bot replies with a rich embed containing:
   - **Original** — the source text
   - **Translation (AI)** — Ollama's translation
   - **Linguistic Notes** — grammar/vocabulary explanation from Ollama
   - **Translation (DeepL)** — reference translation (if configured)
   - **Footer** — provider attribution and detected source language

#### Limitations

| Limitation | Detail |
|---|---|
| **AI quality varies** | Ollama translation quality depends on the model. Common language pairs (EN↔ES, EN↔FR) work best. |
| **DeepL free tier** | 500,000 characters/month. Sufficient for typical Discord usage. |
| **Language codes** | Uses ISO 639-1 uppercase codes (EN, ES, FR, DE, JA, etc.). Invalid codes may produce unexpected results. |
| **Response time** | Ollama translation may take a few seconds depending on text length and hardware. |
| **No conversation context** | Each translation is independent — the bot doesn't remember previous translations in the channel. |

---

## Shadowrun Campaign System

The bot includes a full Shadowrun 5th Edition tabletop RPG system. The bot acts as Game Master, using a local Ollama LLM to generate narrative content — campaign settings, scene descriptions, NPC dialogue, and story progression.

### How It Works

1. **Create characters** with `/character create <name>` — each player builds their character via DM wizard (can be done before any campaign starts)
2. **Start a campaign** with `/campaign start` — the AI generates a setting, objective, and opening narrative
3. **Add players** with `/campaign addplayer @user` — if a player already has an unassigned character, it's linked automatically; otherwise they receive a DM to create one
4. **Play in the campaign channel** — players chat and describe their actions in the designated channel
4. **Advance the story** by @mentioning the bot — it reads all messages since the last mention, feeds them to the AI as player actions, and responds with the next narrative beat
5. **Dice rolls happen automatically** when the AI determines a skill check is needed, or players can manually `/roll` with Edge

### Character Creation

When added to a campaign, players receive a DM from the bot walking them through character creation:

1. **Metatype** — Human, Elf, Dwarf, Ork, or Troll (each with unique attribute limits and abilities)
2. **Archetype** — Street Samurai, Decker, Mage, Shaman, Rigger, Face, Adept, or Technomancer
3. **Attributes** — 24 points to distribute across 8 attributes (Body, Agility, Reaction, Strength, Willpower, Logic, Intuition, Charisma)
4. **Skills** — 36 skill points + 5 skill group points
5. **Qualities** — Positive and negative traits
6. **Magic/Resonance** — For magical or technomancer archetypes
7. **Gear** — Starting equipment based on archetype
8. **Contacts** — NPCs the character knows
9. **Backstory** — Character background and motivation
10. **Review & Finalize** — Confirm the character sheet

### Discord Developer Portal Reminders

The campaign system requires additional bot configuration:

- **Privileged Gateway Intents** (Bot tab): Enable **Direct Messages** intent for character creation DMs
- **Bot Permissions**: The bot needs **Send Messages**, **Embed Links**, and **Read Message History** in the campaign channel
- **OAuth2 Scopes**: Ensure both `bot` and `applications.commands` scopes are included

---

## XP / Leveling System

The bot awards 15–25 XP per message (randomized), with a 60-second cooldown per user to prevent spam farming. XP accumulates and determines your level using the formula: `XP for level N = 5N² + 50N + 100` (cumulative).

There are 100 named ranks (a mix of Hitchhiker's Guide to the Galaxy and Lincoln, Nebraska references) that are automatically assigned as you level up. Level-up announcements are posted when a user reaches a new level.

Role rewards can be configured in the `level_role_rewards` database table to auto-assign Discord roles at specific level thresholds.

---

## AI Chat

Mention the bot (`@Trillian`) in any message and it will respond conversationally using a local Ollama instance. The bot has a friendly, witty personality with occasional Hitchhiker's Guide to the Galaxy references.

### Setup

1. Install [Ollama](https://ollama.ai/)
2. Pull the model: `ollama pull mistral-nemo:12b`
3. Ensure Ollama is running (`ollama serve`)
4. The bot connects to `http://localhost:11434` by default — configure `OLLAMA_URL` if running elsewhere

---

## Windows Setup (from scratch)

Step-by-step guide for deploying the bot on a Windows machine.

### 1. Install Node.js

1. Go to https://nodejs.org/ and download the **LTS** installer (`.msi`)
2. Run the installer — accept defaults, but make sure **"Add to PATH"** is checked
3. Open **PowerShell** and verify:
   ```powershell
   node --version   # should show v18+ or v20+
   npm --version
   ```

### 2. Install pnpm

```powershell
npm install -g pnpm
pnpm --version
```

### 3. Install Ollama

1. Go to https://ollama.ai/ and download the Windows installer
2. Run the installer
3. Open a **new PowerShell window** and pull the model:
   ```powershell
   ollama pull mistral-nemo:12b
   ```
   This download is ~7 GB and may take a while.

### 4. Clone and set up the bot

```powershell
git clone <your-repo-url> DiscordBot
cd DiscordBot
pnpm install
```

If you don't have Git installed, download it from https://git-scm.com/download/win or just download the repo as a ZIP and extract it.

### 5. Configure

```powershell
copy .env.example .env
```

Open `.env` in Notepad (or any text editor) and fill in your values:
```
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id-here
DISCORD_GUILD_ID=your-server-id-here
```

### 6. Build and run

```powershell
pnpm build
pnpm db:migrate
pnpm deploy-commands
pnpm start
```

### 7. Keep the bot running

The bot stops when you close PowerShell. To keep it running 24/7:

**Option A: PM2 (recommended)**

PM2 is a process manager that auto-restarts your bot if it crashes.

```powershell
npm install -g pm2
pnpm build
pm2 start dist/index.js --name "discord-bot"
pm2 save
pm2 startup
```

Useful PM2 commands:
```powershell
pm2 status          # check if the bot is running
pm2 logs discord-bot # view bot logs
pm2 restart discord-bot # restart the bot
pm2 stop discord-bot    # stop the bot
```

**Option B: Task Scheduler**

1. Open **Task Scheduler** (search for it in the Start menu)
2. Click **Create Basic Task**
3. Name it "Discord Bot" and set the trigger to **When the computer starts**
4. Action: **Start a program**
   - Program: `powershell.exe`
   - Arguments: `-NoExit -Command "cd C:\path\to\DiscordBot; pnpm start"`
5. Check **"Run whether user is logged on or not"** in the task properties

**Option C: Run as a Windows Service**

For a more robust setup, use [node-windows](https://github.com/coreybutler/node-windows) to install the bot as a Windows service that starts automatically on boot and restarts on crash.

### Keeping Ollama running

Ollama needs to be running for the AI chat feature to work. After installing Ollama on Windows, it typically runs as a background service automatically. Verify with:

```powershell
ollama list
```

If it's not running, start it with:
```powershell
ollama serve
```

To make sure Ollama starts on boot, check that "Ollama" appears in your startup apps (Settings > Apps > Startup).

### 8. Auto-deploy on push (optional)

Automatically pull, rebuild, and restart the bot when you push to GitHub from your dev machine.

**On the Windows machine:**

1. Generate a random webhook secret (any random string works):
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Add the secret to your `.env` file:
   ```
   DEPLOY_WEBHOOK_SECRET=your-generated-secret-here
   DEPLOY_WEBHOOK_PORT=9000
   ```

3. Start the webhook listener alongside the bot:
   ```powershell
   pnpm build
   pm2 start dist/deploy-webhook.js --name "deploy-webhook"
   pm2 save
   ```

4. Open port 9000 on Windows Firewall:
   - Search **"Windows Defender Firewall"** in the Start menu
   - Click **"Advanced settings"** on the left
   - Click **"Inbound Rules"** > **"New Rule..."**
   - Select **Port** > **TCP** > Specific port: **9000**
   - Allow the connection, give it a name like "Deploy Webhook"

5. If behind a router, forward port 9000 to the Windows machine's local IP

**On GitHub:**

1. Go to your repo > **Settings** > **Webhooks** > **Add webhook**
2. Payload URL: `http://YOUR_PUBLIC_IP:9000/webhook`
3. Content type: `application/json`
4. Secret: paste the same secret from step 1
5. Events: select **"Just the push event"**
6. Click **Add webhook**

Now when you `git push` from your Mac, the Windows machine will automatically pull, build, migrate, deploy commands, and restart the bot.

Check the webhook logs with:
```powershell
pm2 logs deploy-webhook
```

---

## Adding a New Command

1. Create `src/commands/my-command.ts` implementing the `Command` interface
2. Import and add it to the array in `src/commands/index.ts`
3. Run `pnpm deploy-commands` to register the slash command

See `src/commands/ping.ts` for a simple example.

## Adding a New Event Handler

1. Create `src/events/my-event.ts` implementing the `EventHandler` interface
2. Import and add it to the array in `src/events/index.ts`

See `src/events/ready.ts` for an example.

## Project Structure

```
src/
  clients/         # Discord client (event wiring, connection)
  engines/         # Business logic
  accessors/       # Data access (Discord API, database)
  commands/        # Command definitions
  events/          # Event handler definitions
  types/           # Shared interfaces and contracts
  db/              # Database schema (Drizzle ORM)
  utilities/       # Config, logging, helpers
```

## Development

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build
pnpm build

# Generate DB migration after schema changes
pnpm db:generate

# Run DB migrations
pnpm db:migrate
```
