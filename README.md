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
| `MUSIC_CLUB_CHANNEL_ID` | Channel for music club posts (required to enable the feature) |
| `MUSIC_CLUB_ROUND_DAY` | Day of week to start rounds (0=Sun..6=Sat, default: `1` / Monday) |
| `MUSIC_CLUB_ROUND_TIME` | Time to start rounds in 24h format (default: `10:00`) |
| `MUSIC_CLUB_SUBMISSION_DAYS` | Days submissions stay open (default: `2`) |
| `MUSIC_CLUB_RATING_DAYS` | Days ratings stay open after submissions close (default: `2`) |

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
| `/musicclub join` | Join the weekly music club | Everyone |
| `/musicclub leave` | Leave the music club | Everyone |
| `/musicclub submit <url> [reason]` | Submit a song for the current round | Music Club Members |
| `/musicclub rate` | Start the rating wizard (walks through each song) | Music Club Members |
| `/musicclub playlist [id]` | View the current or a specific round's playlist | Everyone |
| `/musicclub results [id]` | View results for a completed round | Everyone |

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

### `/vocab`

Review, list, and quiz your saved vocabulary words. Words are posted daily in a configured channel (Word of the Day), and users can save them with a button. This command lets you interact with your saved vocabulary.

#### Usage

| Invocation | Example |
|---|---|
| Slash command (new) | `/vocab new` |
| Slash command (review) | `/vocab review` |
| Slash command (list) | `/vocab list` |
| Slash command (stats) | `/vocab stats` |
| Slash command (flashcard) | `/vocab flashcard` |
| Prefix command (new) | `!vocab new` |
| Prefix command (review) | `!vocab review` |
| Prefix command (list) | `!vocab list` |
| Prefix command (stats) | `!vocab stats` |
| Prefix command (flashcard) | `!vocab flashcard` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `new` | Generate a new vocabulary word on demand |
| `review` | Take a multiple-choice quiz on a due word (spaced repetition) |
| `list` | View your saved vocabulary words with due dates and review accuracy |
| `stats` | View aggregate vocabulary review statistics |
| `flashcard` | Study due words with flip-card style review and self-rating |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `VOCAB_CHANNEL_ID` | No | — | Channel where daily Word of the Day is posted. If omitted, the daily timer is disabled. |
| `VOCAB_DAILY_TIME` | No | `08:00` | Time (24h format, server local time) to post the daily word. |
| `VOCAB_DEFAULT_LANGUAGE` | No | `ES` (Spanish) | Language code for generated vocabulary words. |

Ollama must be running (same setup as AI Chat). No additional Ollama configuration needed.

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. **Word of the Day** — Every day at the configured time, the bot generates a vocabulary word via Ollama and posts it as a rich embed with translation, pronunciation, example sentence, and linguistic notes. A "Save to Vocab" button is attached.
2. **New (`/vocab new`)** — Anyone can generate a new word on demand. Uses the same generation pipeline as the daily word — the word is saved to the database and posted with a "Save to Vocab" button.
3. **Save** — Users click "Save to Vocab" to add the word to their personal vocabulary. Duplicate saves are detected and handled gracefully.
4. **Review (`/vocab review`)** — Picks a due word from the user's saved vocabulary (using SM-2 spaced repetition scheduling) and presents a 4-option multiple-choice quiz. Three distractors are pulled from other words in the same language. Correct answers schedule the word further out; incorrect answers reset it. Falls back to a random word if none are due.
5. **List (`/vocab list`)** — Shows the user's saved words with language, translation, due status (due now, hours, or days until next review), review count, and accuracy percentage. Limited to 20 entries.
6. **Stats (`/vocab stats`)** — Shows aggregate stats: total words saved, total reviews, correct answers, and overall accuracy percentage.
7. **Flashcard (`/vocab flashcard`)** — Presents due words one at a time in a flip-card format. The front shows the word; click "Flip Card" to reveal the translation, pronunciation, and example sentence. Rate your recall with Again/Hard/Good/Easy buttons (SM-2 quality ratings). The next review date is calculated based on your rating. Click "Next Card" to continue studying. If no words are due, shows when the next review is scheduled.

#### Limitations

| Limitation | Detail |
|---|---|
| **AI word quality** | Word generation quality depends on the Ollama model. Common languages (ES, FR, DE) work best. |
| **Spaced repetition** | Review scheduling uses the SM-2 algorithm. New/unseen words are treated as immediately due. |
| **Quiz requires 4+ words** | If fewer than 4 words exist in the same language, distractors may be limited. |
| **Daily post timing** | Uses a 60-second polling interval, so the post may be up to 1 minute late. |
| **List limit** | Only the 20 most recent saved words are shown in the list embed. |

---

### `/lesson`

Start, stop, or check the status of a private DM-based language tutoring session. An AI tutor (powered by Ollama) conducts an interactive conversation lesson in your chosen language. Conversation history is persisted with a 20-message rolling context window.

#### Usage

| Invocation | Example |
|---|---|
| Slash command (start) | `/lesson start` or `/lesson start language:FR` |
| Slash command (stop) | `/lesson stop` |
| Slash command (status) | `/lesson status` |
| Prefix command (start) | `!lesson start` or `!lesson start FR` |
| Prefix command (stop) | `!lesson stop` |
| Prefix command (status) | `!lesson status` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `start [language]` | Start a new lesson. The bot DMs you a greeting and begins tutoring. Defaults to the server's configured language. |
| `stop` | End your current lesson session. |
| `status` | Check if you have an active lesson and see details. |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `language` | string | No | `VOCAB_DEFAULT_LANGUAGE` (default `ES`) | Language code (e.g. `ES`, `FR`, `DE`, `JA`). Case-insensitive. |

#### Permission

Everyone — no special permissions required.

#### Configuration

No additional environment variables needed. Reuses `VOCAB_DEFAULT_LANGUAGE` for the default lesson language. Ollama must be running (same setup as AI Chat).

#### Bot Permissions Required

- Send Messages
- Direct Messages (the bot must be able to DM users)

#### Behavior

1. **Start (`/lesson start`)** — Creates a new lesson session. The bot sends the user a DM with an AI-generated greeting in the target language and begins tutoring.
2. **Conversation** — All subsequent DMs from the user are routed to the AI tutor. The tutor corrects mistakes, introduces vocabulary, asks follow-up questions, and adapts to the student's level. A rolling 20-message context window is maintained.
3. **Stop (`/lesson stop`)** — Ends the active session. Can also type "stop", "end", "quit", or "exit" in DMs.
4. **Status (`/lesson status`)** — Shows whether you have an active lesson, the language, and when it started.
5. **Priority** — Character creation DMs always take priority over lesson DMs. If character creation is in progress, lesson messages are ignored until creation completes.

#### Limitations

| Limitation | Detail |
|---|---|
| **One session at a time** | Users can only have one active lesson. Stop the current one before starting another. |
| **AI quality** | Tutoring quality depends on the Ollama model. Larger models produce better lessons. |
| **Context window** | Only the last 20 messages (plus system prompt) are sent to Ollama per turn. Earlier conversation is not included. |
| **DM availability** | The bot must be able to DM the user. Users with DMs disabled from server members will not receive lessons. |
| **Response length** | AI responses are truncated to 2000 characters (Discord message limit). |

---

### `/challenge`

View results and leaderboards for daily translation challenges. Every day, the bot posts a sentence to translate; users submit translations via a modal dialog, and an AI grades each submission on accuracy, grammar, and naturalness (each 1–10). When the time window closes, results are posted automatically.

#### Usage

| Invocation | Example |
|---|---|
| Slash command (results) | `/challenge results` or `/challenge results id:5` |
| Slash command (leaderboard) | `/challenge leaderboard` |
| Prefix command (results) | `!challenge results 5` |
| Prefix command (leaderboard) | `!challenge leaderboard` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `results [id]` | View results for a specific challenge. Defaults to the most recent challenge. |
| `leaderboard` | View the overall translation challenge leaderboard ranked by average score. |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | integer | No | Most recent | Challenge ID to view results for. |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `CHALLENGE_CHANNEL_ID` | No | — | Channel where daily challenges are posted. If omitted, the daily timer is disabled. |
| `CHALLENGE_DAILY_TIME` | No | `09:00` | Time (24h format, server local time) to post the daily challenge. |
| `CHALLENGE_DIRECTION` | No | `to_english` | Translation direction: `to_english` or `from_english`. |
| `CHALLENGE_DURATION_MINUTES` | No | `480` | How long (in minutes) submissions stay open before the challenge closes. |

Reuses `VOCAB_DEFAULT_LANGUAGE` for the target language. Ollama must be running (same setup as AI Chat).

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. **Daily Challenge** — Every day at the configured time, the bot generates a sentence via Ollama (optionally incorporating recent vocabulary words) and posts it as a rich embed with a "Submit Translation" and "View Results" button.
2. **Submit Translation** — Users click "Submit Translation" to open a modal dialog where they enter their translation. The translation is graded by Ollama on three dimensions: accuracy, grammar, and naturalness (each 1–10). A composite score (average of three) is calculated. Users receive an ephemeral grade embed immediately after submission.
3. **Resubmission** — Users can resubmit to update their translation and grade before the challenge closes.
4. **Auto-Close** — When the time window expires, the bot automatically closes the challenge, edits the original message to remove the submit button, and posts a results embed showing the top submissions ranked by composite score.
5. **Results (`/challenge results`)** — View results for any challenge by ID, or the most recent challenge if no ID is provided.
6. **Leaderboard (`/challenge leaderboard`)** — Shows the top 20 users ranked by average composite score across all challenges, with total challenges participated in.

#### Limitations

| Limitation | Detail |
|---|---|
| **AI grading consistency** | Grading is performed by Ollama and may vary slightly between runs for similar translations. |
| **One submission per user** | Each user can only have one active submission per challenge (resubmission replaces the previous one). |
| **Daily post timing** | Uses a 60-second polling interval, so the post may be up to 1 minute late. |
| **Close timing** | Uses a 30-second polling interval to detect expired challenges. |
| **Leaderboard limit** | Only the top 20 users are shown on the leaderboard. |

---

### `/musicclub`

A weekly music club where members submit songs, listen to each other's picks, and rate them. Songs are resolved via the [Odesli/song.link](https://odesli.co/) API to provide cross-platform links (Spotify, YouTube, Apple Music, Tidal, etc.).

#### Usage

| Type | Example |
|---|---|
| Slash | `/musicclub join` |
| Slash | `/musicclub submit url:https://open.spotify.com/track/... reason:This song changed my life` |
| Slash | `/musicclub rate` |
| Slash | `/musicclub playlist` |
| Slash | `/musicclub results` |
| Prefix | `!musicclub join` |
| Prefix | `!musicclub submit https://open.spotify.com/track/... This song changed my life` |
| Prefix | `!musicclub rate` (redirects to slash command wizard) |

#### Subcommands

| Subcommand | Description |
|---|---|
| `join` | Join the music club to submit and rate songs |
| `leave` | Leave the music club |
| `submit` | Submit a song for the current round (one per member per round; resubmitting replaces) |
| `rate` | Start the rating wizard — walks through each song with 1-10 buttons. Can re-rate by running again. |
| `playlist` | View the current round's playlist with cross-platform links |
| `results` | View results for a completed round, ranked by average rating |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` (submit) | string | Yes | — | A link to a song on any streaming platform |
| `reason` (submit) | string | No | — | Why you picked this song |
| `id` (playlist/results) | integer | No | Current/latest round | A specific round ID |

#### Permission

Everyone can use all subcommands. Submitting and rating require music club membership (use `/musicclub join` first).

#### Configuration

| Variable | Description | Default |
|---|---|---|
| `MUSIC_CLUB_CHANNEL_ID` | Channel for music club posts (required to enable) | — |
| `MUSIC_CLUB_ROUND_DAY` | Day of week to start rounds (0=Sun, 1=Mon, ..., 6=Sat) | `1` (Monday) |
| `MUSIC_CLUB_ROUND_TIME` | Time to start rounds (HH:MM, local time) | `10:00` |
| `MUSIC_CLUB_SUBMISSION_DAYS` | Days submissions stay open | `2` |
| `MUSIC_CLUB_RATING_DAYS` | Days ratings stay open after submissions close | `2` |

#### Bot Permissions Required

- Send Messages
- Embed Links (for rich playlist/results embeds)

#### Behavior

1. **Round starts** at the configured day/time. The bot posts an announcement with a "Submit a Song" button.
2. **Members submit songs** via the button (opens a modal) or `/musicclub submit`. Each member can submit one song per round. Resubmitting replaces the previous pick. The bot resolves cross-platform links via Odesli.
3. **Submissions close** after `MUSIC_CLUB_SUBMISSION_DAYS`. The bot posts the full playlist with each song's title, artist, submitter, reason text, and links to Spotify, YouTube, Apple Music, Tidal, etc. Each song gets a "Rate" button.
4. **Members rate songs** by clicking "Rate Songs" or using `/musicclub rate`. The bot walks through each song one-by-one with 1-10 buttons (skipping your own song). You can skip songs or re-run the wizard to change ratings.
5. **Ratings close** after `MUSIC_CLUB_RATING_DAYS`. The bot posts results ranked by average rating with medal emojis for the top 3.

#### Limitations

| Constraint | Detail |
|---|---|
| **One song per member per round** | Resubmitting replaces the previous song |
| **Cannot rate your own song** | The engine blocks self-ratings |
| **Odesli rate limit** | 10 requests/minute without an API key; sufficient for small clubs |
| **Odesli failure is non-fatal** | If Odesli can't resolve the link, the song is still accepted with just the original URL |
| **Timer polling** | 60-second interval, so transitions may be up to 1 minute late |

---

### `/recipe`

A recipe book that automatically scans a designated channel for recipes. When someone posts a recipe, the bot uses Ollama to extract the title, ingredients, and instructions, then stores them in a searchable database. Users can browse, search by ingredient, and view full recipe details.

#### Usage

| Type | Example |
|---|---|
| Slash | `/recipe list` |
| Slash | `/recipe search ingredient:chicken` |
| Slash | `/recipe view id:3` |
| Slash | `/recipe help` |
| Prefix | `!recipe list` |
| Prefix | `!recipe search chicken` |
| Prefix | `!recipe view 3` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `list` | Browse all saved recipes (paginated, 10 per page) |
| `search` | Search recipes by ingredient name (fuzzy match) |
| `view` | View full details for a recipe by its ID number |
| `help` | Show available recipe commands and tips |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `page` (list/search) | integer | No | 1 | Page number for paginated results (min: 1) |
| `ingredient` (search) | string | Yes | — | Ingredient to search for (e.g. "chicken", "garlic") |
| `id` (view) | integer | Yes | — | Recipe ID number (shown in list/search results) |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Variable | Description | Default |
|---|---|---|
| `RECIPE_CHANNEL_ID` | Channel the bot watches for recipes (required to enable) | — |

**Setup:**
1. Create a channel in your server for sharing recipes.
2. Copy the channel ID and set it as `RECIPE_CHANNEL_ID` in `.env`.
3. Restart the bot. On startup, it will backfill any historical recipes already posted in the channel.

#### Bot Permissions Required

- Send Messages
- Embed Links (for rich recipe embeds)
- Add Reactions (to react with a frying pan emoji when a recipe is saved)
- Read Message History (to backfill old recipes on startup)

#### Behavior

1. **Automatic detection:** Any non-bot message over 30 characters in the recipe channel is sent to Ollama for analysis.
2. **Parsing:** Ollama extracts the recipe title, ingredients (with quantities), instructions, and any source URL.
3. **Storage:** The recipe and its ingredients are stored in the database. Ingredients are normalized (lowercased) for consistent search.
4. **Confirmation:** The bot reacts to the message with a frying pan emoji to confirm the recipe was saved.
5. **Deduplication:** Each message is only processed once (tracked by message ID). Re-running the backfill or restarting the bot won't create duplicates.
6. **Backfill:** On startup, the bot scans all historical messages in the recipe channel, processing any that haven't been stored yet.

#### Limitations

| Constraint | Detail |
|---|---|
| **Ollama required** | Recipe parsing uses the configured Ollama model; if Ollama is down, recipes won't be detected |
| **Minimum message length** | Messages under 30 characters are skipped (unlikely to be recipes) |
| **One recipe per message** | Each message is treated as a single recipe |
| **Ingredient search is substring-based** | Searching "chicken" matches "chicken breast", "chicken thigh", etc. |
| **Backfill runs sequentially** | Processing many historical messages may take time due to Ollama inference speed |

---

### `/cleanurl`

Manually clean tracking parameters from a URL. Also works automatically in configured channels — the bot watches for links with tracking junk, replies with the clean version, and suppresses the original message's embeds.

#### Usage

| Type | Example |
|---|---|
| Slash | `/cleanurl url:https://example.com/page?utm_source=twitter&fbclid=abc` |
| Prefix | `!cleanurl https://example.com/page?utm_source=twitter&fbclid=abc` |

#### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` | string | Yes | — | The URL to clean |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Variable | Description | Default |
|---|---|---|
| `CLEAN_LINKS_CHANNEL_IDS` | Comma-separated channel IDs where the bot auto-cleans links. If empty, all channels are watched. | — (all channels) |

**Setup:**
The feature is active in all channels by default. To restrict it to specific channels, set `CLEAN_LINKS_CHANNEL_IDS` in `.env` (comma-separated). The `/cleanurl` command works everywhere regardless of this setting.

#### Bot Permissions Required

- Send Messages
- Manage Messages (to suppress embeds on the original message)

#### Behavior

1. **Automatic mode (event handler):** When a message is posted in a configured channel, the bot extracts all URLs and checks for tracking parameters.
2. **Tracking parameter removal:** Strips known trackers including `utm_*`, `fbclid`, `gclid`, `msclkid`, `igshid`, `si` (Spotify/YouTube), `feature` (YouTube), HubSpot/Adobe/Mailchimp params, and more.
3. **Shortened URL resolution:** For known shortener domains (`bit.ly`, `t.co`, `amzn.to`, etc.), the bot follows redirects via HEAD requests to get the final URL, then strips tracking params from it.
4. **Reply with clean URL:** If any URLs were cleaned, the bot replies to the original message with the clean versions.
5. **Embed suppression:** The bot suppresses the original message's embeds so only the clean URL's preview is shown.
6. **Manual mode (`/cleanurl`):** Accepts a single URL and returns the cleaned version. Works in any channel.

#### Limitations

| Constraint | Detail |
|---|---|
| **All channels by default** | Auto-cleaning runs everywhere unless `CLEAN_LINKS_CHANNEL_IDS` restricts it |
| **Shortened URL timeout** | Redirect resolution has a 5-second timeout per hop (max 10 hops) — if the shortener is down, the original URL is returned as-is |
| **Known trackers only** | Only strips parameters from a curated blocklist — novel tracking params may slip through |
| **No original embed control without Manage Messages** | The bot needs Manage Messages permission to suppress the original message's embeds |

### `/library`

Community library — share, borrow, and discover books with your server. Add books by ISBN or bookstore URL (Amazon, Barnes & Noble, Open Library, Google Books). The bot fetches metadata and cover art from Open Library.

#### Usage

| Type | Example |
|---|---|
| Slash | `/library add isbn_or_url:9780143127550 condition:Good availability:Lend note:Hardcover edition` |
| Slash | `/library add isbn_or_url:https://www.amazon.com/dp/0143127551` |
| Slash | `/library search query:sapiens` |
| Slash | `/library borrow entry_id:42` |
| Prefix | `!library add 9780143127550 good lend Hardcover edition` |
| Prefix | `!library search sapiens` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `add <isbn_or_url> [condition] [availability] [note]` | Add a book to the library |
| `remove <entry_id>` | Remove your book from the library |
| `list [page]` | Browse all available books |
| `search <query> [page]` | Search by title or author |
| `shelf [@user] [page]` | View a member's shared books (defaults to you) |
| `info <entry_id>` | Detailed book view with action buttons |
| `borrow <entry_id>` | Request to borrow a book |
| `wishlist <add\|remove\|list> [query]` | Manage your book wishlist |
| `review <isbn_or_url> <rating 1-5> [text]` | Rate and review a book |
| `stats` | View library statistics |
| `help` | Show help |

#### Parameters

| Parameter | Type | Required | Default | Range | Description |
|---|---|---|---|---|---|
| `isbn_or_url` | string | Yes | — | — | ISBN-10, ISBN-13, or bookstore URL |
| `entry_id` | integer | Yes (for remove/info/borrow) | — | — | Book entry ID (shown in listings) |
| `condition` | string choice | No | good | like_new, good, fair, poor | Physical condition of the book |
| `availability` | string choice | No | lend | lend, give, reference | How you want to share |
| `note` | string | No | — | max 1000 chars | Note about the book (condition details, pickup instructions) |
| `query` | string | Yes (for search) | — | — | Search text for title/author |
| `rating` | integer | Yes (for review) | — | 1–5 | Star rating |
| `text` | string | No | — | — | Review text |
| `action` | string choice | Yes (for wishlist) | — | add, remove, list | Wishlist action |

#### Permission

Everyone — no special permissions required.

#### Configuration

| Variable | Description | Default |
|---|---|---|
| `LIBRARY_CHANNEL_ID` | Channel where the library lives. The command only works in this channel. | — (disabled) |
| `LIBRARY_DEFAULT_LOAN_DAYS` | Default loan period in days for approved borrows | 14 |

**Setup:**
1. Set `LIBRARY_CHANNEL_ID` in `.env` to the channel where you want the library
2. Run `pnpm deploy-commands` to register the slash command
3. Users can start adding books with `/library add`

#### Bot Permissions Required

- Send Messages
- Embed Links (for book cards with cover art)

#### Behavior

1. **Adding a book:** User provides ISBN or bookstore URL. The bot extracts the ISBN, looks up metadata from Open Library (title, author, cover, description, page count, genres), and creates a library entry. If someone has the book on their wishlist, they get a DM notification.
2. **URL parsing:** Supports Amazon (`/dp/` and `/gp/product/` paths), Open Library, Google Books (`isbn=` param), Barnes & Noble (`ean=` param), and generic URLs containing ISBN patterns. If no ISBN can be extracted, the user is alerted.
3. **Borrowing:** The borrower uses `borrow` → the owner gets a DM with Approve/Deny buttons → on approval, the book is marked as checked out with a due date → when returned, it becomes available again.
4. **Give-away:** Books marked as "give" follow the same borrow flow, but when "returned" (i.e., the handoff is complete), the entry is automatically removed from the library.
5. **Info view:** Shows full book details with context-sensitive buttons — owner sees "Edit Note", borrower sees "Return", others see "Borrow" (when available).
6. **Overdue reminders:** A timer checks hourly for overdue borrows and DMs both the borrower and owner (once per 24 hours per borrow).
7. **Wishlist:** Users can add books to a wishlist. When someone adds a matching book to the library, wishlist holders get a DM.
8. **Reviews:** One review per user per book per guild. Displayed on the info view with star ratings.
9. **Stats:** Shows total books, total borrows, most borrowed books, top lenders, and genre breakdown.

#### Limitations

| Constraint | Detail |
|---|---|
| **Open Library only** | Metadata comes from Open Library — books not in their database won't be found |
| **ISBN required** | Books must have a valid ISBN-10 or ISBN-13 to be added |
| **Amazon ASINs** | Amazon ASINs are only valid ISBNs for physical books — Kindle editions and bundles may not work |
| **One copy per owner** | A user can only add the same ISBN once (but different users can each add their own copy) |
| **Channel-locked** | The command only works in the configured `LIBRARY_CHANNEL_ID` channel |
| **DM-dependent** | Borrow approvals and notifications are sent via DM — users with DMs disabled will miss them |

---

### `/stats`

Daily channel activity summary — shows message counts, top posters, media/link breakdowns, recipe and library additions, and per-channel stats for the current day.

#### Usage

| Type | Example |
|---|---|
| Slash | `/stats today` |
| Slash | `/stats help` |
| Prefix | `!stats` |
| Prefix | `!stats help` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `today` | Show today's activity summary (default for prefix) |
| `help` | Show help for the stats command |

#### Parameters

None — the command summarizes all channels from midnight to now.

#### Permission

Everyone — requires Send Messages permission.

#### Configuration

No additional environment variables required.

#### Bot Permissions Required

- Send Messages
- Embed Links
- Read Message History (in all channels you want stats for)

#### Behavior

1. The bot fetches all messages from midnight (server local time) to now across every text channel it can access
2. Bot messages are excluded from all counts
3. A **server summary embed** shows total messages, unique posters, media/link counts, recipes added, library additions, busiest hour, and top 10 posters
4. A **channel breakdown** follows, showing per-channel stats (messages, posters, media, links, top 3 posters) sorted by activity
5. Recipe and library addition counts come from the database, not message parsing

#### Limitations

| Constraint | Detail |
|---|---|
| **Current day only** | Stats cover midnight-to-now; no historical lookups |
| **Bot visibility** | Only channels the bot has Read Message History access to are included |
| **API pagination** | Very active channels require multiple Discord API calls (100 messages per call), which may take a moment |
| **Embed limit** | Discord allows max 10 embeds per message — servers with 50+ active channels may see truncated channel breakdowns |

---

### `/birthday`

Track and celebrate birthdays. Mods manually add birthdays for server members (and their family). The bot posts daily announcements in a configured channel.

#### Usage

| Type | Example |
|---|---|
| Slash | `/birthday add month:3 day:15 user:@someone` |
| Slash | `/birthday add month:6 day:1 user:@someone person:wife` |
| Slash | `/birthday remove user:@someone` |
| Slash | `/birthday remove user:@someone person:wife` |
| Slash | `/birthday list` |
| Slash | `/birthday list user:@someone` |
| Slash | `/birthday help` |
| Prefix | `!birthday add 3 15 @someone` |
| Prefix | `!birthday add 6 1 @someone wife` |
| Prefix | `!birthday remove @someone` |
| Prefix | `!birthday remove @someone wife` |
| Prefix | `!birthday list` |
| Prefix | `!birthday list @someone` |
| Prefix | `!birthday help` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `add <month> <day> <@user> [person]` | Add a birthday for a user. Leave person blank for the user themselves. |
| `remove <@user> [person]` | Remove a birthday. No person = remove all entries for that user. |
| `list [@user]` | List stored birthdays. No user = show all. |
| `help` | Show help for the birthday command. |

#### Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `month` | Integer | Yes (add) | Month number (1-12) |
| `day` | Integer | Yes (add) | Day number (1-31) |
| `user` | User mention | Yes (add/remove) | Whose birthday to add or remove |
| `person` | String | No | Relationship or name (e.g. "wife", "son Jake"). Omit for the user themselves. |

#### Permission

All subcommands require **Manage Messages** permission. The command is hidden from non-mods via `setDefaultMemberPermissions`.

#### Configuration

| Variable | Default | Description |
|---|---|---|
| `BIRTHDAY_CHANNEL_ID` | *(none)* | Channel where daily birthday announcements are posted. Required for announcements. |
| `BIRTHDAY_CHECK_TIME` | `08:00` | Time (HH:MM, 24h local) to check and post daily birthday announcements. |

#### Bot Permissions Required

- Send Messages
- Embed Links (for help and list embeds)

#### Behavior

1. Mods add birthdays manually with `/birthday add`
2. At the configured daily time, the bot checks for birthdays matching today's date
3. If any are found, it posts announcements in the configured channel
4. Announcements mention the Discord user: "Happy Birthday, @User!" for self, or "Happy Birthday to @User's wife!" for family members
5. `/birthday list` shows all stored birthdays as an embed

#### Limitations

| Constraint | Detail |
|---|---|
| **No year tracking** | Only month and day are stored — no age tracking |
| **One per person** | Each user can have one entry per person name (self, wife, son, etc.) — adding again updates the date |
| **Mod-only** | Only users with Manage Messages can add, remove, or list birthdays |

---

### `/remind`

Set personal reminders. The bot notifies you when the time comes — via DM by default, or publicly in the channel if you opt in.

#### Usage

| Type | Example |
|---|---|
| Slash | `/remind create when:"in 2 hours" message:"Take out the trash"` |
| Slash | `/remind create when:"tomorrow at 3pm" message:"Call dentist" public:true` |
| Slash | `/remind create when:"next Friday at 5pm" message:"Submit timesheet"` |
| Slash | `/remind list` |
| Slash | `/remind list page:2` |
| Slash | `/remind cancel id:5` |
| Slash | `/remind help` |
| Prefix | `!remind create in 2 hours \| Take out the trash` |
| Prefix | `!remind create public tomorrow at 3pm \| Call dentist` |
| Prefix | `!remind list` |
| Prefix | `!remind cancel 5` |
| Prefix | `!remind help` |

#### Subcommands

| Subcommand | Description |
|---|---|
| `create <when> <message> [public]` | Create a new reminder. Uses natural language time parsing. |
| `list [page]` | List your pending reminders (paginated). |
| `cancel <id>` | Cancel a pending reminder by its ID. |
| `help` | Show help for the remind command. |

#### Parameters

| Parameter | Type | Required | Default | Range | Description |
|---|---|---|---|---|---|
| `when` | String | Yes | — | — | When to be reminded. Natural language: "in 30 minutes", "tomorrow at 3pm", "next Friday at noon" |
| `message` | String | Yes | — | 1–1000 chars | What to remind you about |
| `public` | Boolean | No | `false` | — | If true, reminder is posted publicly in the channel. If false, sent via DM. |
| `id` | Integer | Yes (cancel) | — | — | Reminder ID (shown in `/remind list`) |
| `page` | Integer | No | `1` | 1+ | Page number for list pagination |

#### Permission

Everyone — no special permissions required. Users can only manage their own reminders.

#### Configuration

None — works out of the box. No environment variables needed.

#### Bot Permissions Required

- Send Messages
- Embed Links (for help, list, and reminder delivery embeds)

#### Behavior

1. User creates a reminder with a natural language time expression (parsed by `chrono-node`)
2. The bot confirms the reminder with a Discord timestamp (displayed in the user's local timezone)
3. A background timer checks every 30 seconds for due reminders
4. When a reminder is due:
   - **Private (default):** Bot sends a DM to the user with an embed containing the reminder message
   - **Public:** Bot @mentions the user in the channel where the reminder was created
5. If DM delivery fails (e.g., user has DMs disabled), the bot falls back to a public @mention in the original channel
6. Overdue reminders (e.g., from a bot restart) are delivered on the first timer tick after startup

#### Limitations

| Constraint | Detail |
|---|---|
| **Max 25 active reminders** | Per user. Cancel old ones to make room. |
| **Minimum 1 minute** | Reminders must be at least 1 minute in the future. |
| **Maximum 1 year** | Reminders can't be set more than 1 year ahead. |
| **Server timezone** | Time expressions like "at 3pm" use the bot's server time. Discord timestamps auto-adjust for each user's display. |
| **No recurring reminders** | Each reminder fires once. Set a new one if you need it again. |
| **Message length** | Reminder messages are capped at 1000 characters. |

---

### `/introduction`

Get a personal overview of all bot features. Sends an ephemeral embed (only visible to you) listing every command grouped by category.

#### Usage

| Type | Example |
|---|---|
| Slash | `/introduction` |
| Prefix | `!introduction` |

#### Parameters

None.

#### Permission

Everyone — no special permissions required.

#### Configuration

None — works out of the box.

#### Bot Permissions Required

- Send Messages
- Embed Links

#### Behavior

1. User runs `/introduction`
2. Bot replies with an ephemeral embed (slash) or a regular reply (prefix) containing all available commands grouped into categories: Chat, XP & Leveling, Polls, Weather, Dictionary & Translation, Language Learning, Music Club, Recipes, Library, Shadowrun, and Utilities
3. The footer mentions the prefix alternative for commands

#### Limitations

| Constraint | Detail |
|---|---|
| **Static content** | The feature list is maintained in code. New commands must be added manually to the embed. |

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
