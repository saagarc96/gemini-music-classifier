# Resume Import Guide

## Current Status (Paused at 2025-11-12 2:19 PM)

### Progress Summary:
- **Total songs in database**: 5,215
- **Added today**: 2,960 songs
- **Unreviewed songs**: 3,144

### Completed High-Priority Playlists (7 of 19):
1. ✅ tcrg_main (797 songs)
2. ✅ McFadden's Late Night (337 songs)
3. ✅ Central (334 songs)
4. ✅ Modern Coffeehouse (318 songs)
5. ✅ Commercial Dance (315 songs)
6. ✅ GHK Treatment Rooms (315 songs)
7. ✅ GHK Pool (306 songs)

### Partially Completed:
- **Ambient Spa**: ~230 of 291 songs imported (will skip duplicates on resume)

---

## To Resume: Launch Remaining 12 Playlists

### Strategy: Run 3 playlists at a time for maximum speed

---

## Batch 3 (Resume Here):

```bash
cd /Users/saagar/Desktop/Raina_Projects/gemini-music-classifier

# Process 7: Ambient Spa (resume - will skip already imported)
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/ambient_spa - completed/ambient_spa_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p7.log 2>&1 &

# Process 8: The Longboard Afternoon
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/the_longboard_afternoon/the_longboard_afternoon_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p8.log 2>&1 &

# Process 9: GHK Salon
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/ghk_salon/ghk_salon_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p9.log 2>&1 &

# Check they're running
ps aux | grep "enrich-playlist.cjs" | grep -v grep
```

**Estimated time**: ~1 hour (will finish faster since Ambient Spa is mostly done)

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

**Estimated time**: ~1.5 hours

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

**Estimated time**: ~1.5 hours

---

## Batch 6 (Final):

```bash
# Process 16: Ilima Terrace
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/ilima_terrace/ilima_terrace_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p16.log 2>&1 &

# Process 17: Stevensons
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/stevensons/stevensons_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p17.log 2>&1 &

# Process 18: Close Company Happy Hour
nohup node scripts/enrich-playlist.cjs "/Users/saagar/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output/close_company_happy_hour/close_company_happy_hour_updated.csv" --concurrency=5 --force-duplicates > /tmp/enrich-p18.log 2>&1 &
```

**Estimated time**: ~1.5 hours

---

## Quick Commands

### Check if processes are running:
```bash
ps aux | grep "enrich-playlist.cjs" | grep -v grep
```

### Check overall progress:
```bash
node scripts/check-import-progress.cjs
```

### Monitor a specific process:
```bash
tail -f /tmp/enrich-p7.log   # Ambient Spa
tail -f /tmp/enrich-p8.log   # Longboard Afternoon
# etc...
```

### Check for completion:
```bash
tail -20 /tmp/enrich-p7.log | grep "complete"
```

---

## Total Remaining Time

- **Batch 3**: ~1 hour
- **Batch 4**: ~1.5 hours
- **Batch 5**: ~1.5 hours
- **Batch 6**: ~1.5 hours

**Total**: ~5.5 hours to complete all remaining high-priority playlists

---

## After High-Priority is Complete

You'll have processed ~6,000 songs. Next steps:

1. Review imported songs in web interface
2. Move to Medium Priority playlists (43 playlists, ~8,000 songs)
3. Generate final summary report

---

## Notes

- `--force-duplicates` flag skips duplicate detection (safe because songs are unique by ISRC)
- Processes will auto-skip songs already in database
- Each batch runs 3 playlists × 5 concurrency = 15 songs at once
- Logs are saved to `/tmp/enrich-p*.log`
