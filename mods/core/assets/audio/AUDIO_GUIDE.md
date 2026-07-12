# Audio Asset Guide — TRASHED

All audio should be `.ogg` format (Vorbis). Mono is fine for SFX, stereo for ambience.

## SFX (short one-shot sounds)

| File                       | Duration | Description                                                                           |
| -------------------------- | -------- | ------------------------------------------------------------------------------------- |
| `sfx/footstep.ogg`         | 0.1-0.2s | Soft boot on concrete/metal grate. Think heavy work boot. Pitch-randomized in engine. |
| `sfx/lamp_crackle.ogg`     | 0.3-0.5s | Oil lamp flame crackle/sputter. Quiet, atmospheric.                                   |
| `sfx/item_pickup.ogg`      | 0.2s     | Metallic clink — picking up a scrap/battery from the floor.                           |
| `sfx/wire_spark.ogg`       | 0.2-0.4s | Electrical arc/spark. Brief zap. Startling but not loud.                              |
| `sfx/fuel_warning.ogg`     | 0.5-1s   | Low heartbeat-like thud or warning tone. Plays once when fuel goes critical.          |
| `sfx/relay_reset.ogg`      | 1-2s     | Heavy mechanical clunk + electrical surge. The payoff sound — satisfying.             |
| `sfx/transformer_hum.ogg`  | 0.5-1s   | Electrical 60Hz buzz. Plays when near a relay box.                                    |
| `sfx/upgrade_acquired.ogg` | 0.5s     | Positive chime/ding for purchasing an upgrade.                                        |
| `sfx/cave_enter.ogg`       | 1s       | Descending tone, door creak, echo. Entering the corridors.                            |
| `sfx/cave_exit.ogg`        | 1s       | Ascending tone, relief. Returning to safety.                                          |
| `sfx/player_death.ogg`     | 1-2s     | Lamp extinguishing hiss, fade to silence.                                             |

## Ambience (looping layers)

| File                            | Duration | Description                                                               |
| ------------------------------- | -------- | ------------------------------------------------------------------------- |
| `ambience/hut_room.ogg`         | 15-30s   | Quiet room tone. Distant wind, maybe a clock tick. Cozy safety.           |
| `ambience/corridor_hum.ogg`     | 20-40s   | Underground corridor: distant dripping, faint echoes, metallic resonance. |
| `ambience/electrical_drone.ogg` | 15-30s   | Low 50/60Hz transformer drone. Gets mixed louder as fuel drops.           |

## Notes

- All SFX are triggered by game events (defined in `mods/core/sounds/*.json`)
- Ambience is managed by `AmbientAudioSystem` — loops per scene, crossfades on transition
- The engine gracefully handles missing files (no crash, just silence)
- Pitch randomization is applied in-engine, so record at neutral pitch
- Keep ambience loops seamless (fade in/out or design for clean loop points)
