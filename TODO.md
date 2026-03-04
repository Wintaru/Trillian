# Feature Ideas

Potential features to add to the bot. Not prioritized — pick what's useful.

## Moderation
- [ ] Auto-mod (word filters, spam detection, link filtering)
- [ ] Warn/mute/kick/ban commands with audit logging
- [ ] Slowmode management
- [ ] Raid protection

## Engagement / Fun
- [ ] Welcome messages for new members
- [ ] Role assignment (reaction roles, self-assign menus)
- [ ] Polls / voting
- [ ] Custom embeds builder
- [ ] Leveling / XP system

## Utility
- [ ] Reminders / scheduled announcements
- [ ] Server stats / info commands
- [ ] Logging (message edits/deletes, join/leave, voice activity)
- [ ] Starboard (pin popular messages to a channel)

## Integration
- [ ] Webhooks from external services (GitHub, Twitch, etc.)
- [ ] Music / audio playback
- [ ] AI chat integration

## Architecture Notes

Some features have implications beyond just adding a command:

| Feature | Requires |
|---|---|
| Welcome messages, logging | Event listeners (already scaffolded) |
| Leveling, warnings, starboard, reminders | Database tables (Drizzle schema + migration) |
| Reminders, scheduled announcements | Scheduler (e.g., node-cron) |
| Warn + log + DM workflows | Managers layer (cross-engine orchestration) |
