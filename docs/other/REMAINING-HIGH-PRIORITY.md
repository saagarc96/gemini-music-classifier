# Remaining High-Priority Playlists

## Status: Batch 2 Running (as of 2025-11-12 10:04 AM)

### Currently Processing (Batch 2):
- ✅ Process 4: Commercial Dance (315 songs) - PID 3110
- ✅ Process 5: GHK Treatment Rooms (315 songs) - PID 3111
- ✅ Process 6: GHK Pool (306 songs) - PID 3112

**Estimated completion**: ~2 hours

---

## Batch 3 (Next to launch):

```bash
# Process 7: Ambient Spa
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/ambient_spa - completed/ambient_spa_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p7.log 2>&1 &

# Process 8: The Longboard Afternoon
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/the_longboard_afternoon/the_longboard_afternoon_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p8.log 2>&1 &

# Process 9: GHK Salon
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/ghk_salon/ghk_salon_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p9.log 2>&1 &
```

**Songs**: 289 + 274 + 263 = 826 songs

---

## Batch 4:

```bash
# Process 10: Hotel Contessa Lobby
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/hotel_contessa_lobby/hotel_contessa_lobby_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p10.log 2>&1 &

# Process 11: McFadden's Lunch
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/mcfadden's_lunch/mcfadden's_lunch_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p11.log 2>&1 &

# Process 12: Instrumental Lounge House
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/instrumental_lounge_house/instrumental_lounge_house_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p12.log 2>&1 &
```

**Songs**: 248 + 234 + 228 = 710 songs

---

## Batch 5:

```bash
# Process 13: Instrumental Spanish Guitar
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/instrumental_spanish_guitar/instrumental_spanish_guitar_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p13.log 2>&1 &

# Process 14: Municipal Bar Afternoon
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/municipal_bar_afternoon/municipal_bar_afternoon_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p14.log 2>&1 &

# Process 15: Craft Stampede
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/craft_stampede/craft_stampede_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p15.log 2>&1 &
```

**Songs**: 219 + 212 + 206 = 637 songs

---

## Batch 6 (Final High-Priority):

```bash
# Process 16: Ilima Terrace
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/ilima_terrace/ilima_terrace_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p16.log 2>&1 &

# Process 17: Stevensons
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/stevensons/stevensons_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p17.log 2>&1 &

# Process 18: Close Company Happy Hour
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/close_company_happy_hour/close_company_happy_hour_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p18.log 2>&1 &
```

**Songs**: 202 + 202 + 201 = 605 songs

---

## Quick Commands

### Check if current batch is done:
```bash
ps aux | grep "enrich-playlist.cjs" | grep -v grep
```

### Check progress:
```bash
node scripts/check-import-progress.cjs
```

### View process logs:
```bash
tail -f /tmp/enrich-p4.log  # Commercial Dance
tail -f /tmp/enrich-p5.log  # GHK Treatment Rooms
tail -f /tmp/enrich-p6.log  # GHK Pool
```

### Check for errors:
```bash
grep -i "error\|failed" /tmp/enrich-p*.log
```

---

## Summary

- **Completed**: 4 playlists (1,786 songs)
- **Running (Batch 2)**: 3 playlists (936 songs)
- **Remaining**: 12 playlists (3,178 songs) across 4 more batches
- **Total high-priority**: 19 playlists, ~5,900 songs

**Estimated total time**: 6-8 hours for all remaining batches
