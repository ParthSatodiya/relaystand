# Media

Screen recordings used by the README and [use-cases.md](../use-cases.md).

Every file here is in git forever, and every clone pays for it. Be mean about
it.

## Rules

- **Six files, maximum.** If a seventh feels necessary, one of the six is not
  earning its place.
- **2 MB each, hard cap.** Check before committing: `ls -lh docs/media`.
- **5–8 seconds.** Long enough to show one idea, short enough to loop without
  irritating. One idea per file.
- **Name it for what it shows**, not where it goes: `week-grid.gif`, not
  `readme-1.gif`.
- **No cursor wandering, no hunting for a menu.** Rehearse the click path, then
  record it clean.
- **1280×800 or narrower.** Wider is wasted — GitHub renders it at ~850px.
- **Use seeded, plausible data.** Real names and real ticket numbers are a leak.
  Invent a team.

## Making one small enough

Record to video, then convert — recording straight to GIF gives you a 20 MB
file every time.

```shell
# macOS: ⌘⇧5 records to .mov
ffmpeg -i in.mov -vf "fps=12,scale=1000:-1:flags=lanczos,split[a][b];\
[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer" -loop 0 out.gif
```

`fps=12` and `max_colors=128` are where the savings are. Drop to `fps=10` if it
is still over the cap; the eye barely notices on interface motion.

Consider an `.mp4` instead — GitHub plays it inline in Markdown, and it is
roughly a tenth the size. The catch is it does not autoplay in every context and
will not render at all in a plain-text view of the file.

## Where they are used

| File | Used by |
|---|---|
| `week-grid.gif` | `docs/use-cases.md` top, and the README pitch |
| `start-standup.gif` | `docs/use-cases.md` — the daily loop |
| `reports.gif` | `docs/use-cases.md` — looking back |

The slots are marked with `GIF SLOT` comments in those files. Drop the file in,
swap the comment for an `![alt](path)`, and write real alt text — someone
reading this on a screen reader gets nothing else.
