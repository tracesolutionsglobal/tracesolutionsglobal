# Trace reel builder

Turns each post in `calendar.json` into a 1080×1920, 30 fps MP4. The centre of each video is a 3D browser window that rotates while a website builds itself inside it.

## Setup (once)

```bash
cd tools/reel-builder
npm install
npx playwright install chromium   # skip if Chromium for Playwright is already installed
```

You also need `ffmpeg` and `ffprobe` on your PATH.

## Files it expects (in the folder you run it from)

- `calendar.json`: a list of posts, or `{ "posts": [...] }`. The fields it reads:
  - `date` and `slot`: name the output file, e.g. `2026-11-24_morning.mp4`.
  - `caption`: split into four beats: hook, point, brand reveal and call to action.
  - `angle` (optional): picks the accent colour and the demo site shown in the browser.
  - `voiceover` (optional): the MP3 file name. If it's missing, the script looks in `voiceovers/` for `<date>_<slot>.mp3`, then `<n>.mp3`.
  - `beats` (optional): set the four beats by hand, as `[{kind:'text'|'brand'|'cta', head, white, accent}]`.
- `voiceovers/`: the MP3s.
- `trace_solutions_reel_remastered.mp4`: the music bed. Pass a different file with `--music FILE`.

## Run

```bash
node make_video.js --calendar calendar.json --index 0 --stills
```

That renders one video. `--stills` also saves PNG frames so you can check it.

```bash
node make_video.js --calendar calendar.json --all --skip-existing
```

That renders every post into `output/`.

## How long each video is and how the audio is mixed

- **Length:** the voiceover's length plus 1.5 s, or 20 s if there's no voiceover.
- **With a voiceover:** the music plays at 30% volume and ducks under the voice. It fades out over the last 1.5 s.
- **Without a voiceover:** the music plays alone.

The logo comes from `assets/logo/wordmark.jpg` and is used unchanged, always on a white rounded badge. All text stays inside the safe area: 120 px from the top and 250 px from the bottom.
