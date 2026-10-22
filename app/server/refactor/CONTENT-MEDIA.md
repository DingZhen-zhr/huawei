# Official image layout runtime

PNG output uses Sharp/Pango and an actual Chinese font file. The renderer parses the file, requires the configured face to exist in it, and verifies Chinese glyph coverage (including the Chinese text to render). Missing, invalid, mismatched, or non-Chinese fonts produce failed assets with a sales-friendly configuration message; Pango fallback is not accepted as proof of a valid font.

Windows defaults to `C:/Windows/Fonts/msyh.ttc` / `Microsoft YaHei`, verified in this workspace. An explicit configuration also works:

```powershell
$env:HC_CJK_FONT_PATH = 'C:/Windows/Fonts/msyh.ttc'
$env:HC_CJK_FONT_FAMILY = 'Microsoft YaHei'
```

On Linux install Noto CJK (for example Debian/Ubuntu `fonts-noto-cjk`) and provide its actual font path and family. Recognized default locations include `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc` with family `Noto Sans CJK SC`. Other installations must set `HC_CJK_FONT_PATH` and `HC_CJK_FONT_FAMILY` to the installed file and one of its real face names. Linux deployment has not been verified by this Windows run; run the image tests and visually inspect Chinese PNG output on the target host before release.

All image gates verify the common media payload: the text copy, actual rendered title/subtitle, body/script, summary, CTA, tags, shot list, limitations, and image-plan overlay text. The fingerprint uses this same payload, image plan, product material/facts, store profile, and font configuration. Generation, downloading existing images, and ZIP export use that gate. The `official-layout-v3` rule version invalidates images generated before this complete-payload fingerprint.

The runtime is a single-writer application repository, not a shared multi-process media database. Within that application process, same-variant concurrent requests with the same fingerprint share one job. An already-ready complete PNG set returns HTTP 200 with the existing asset IDs; a conflicting in-flight edit returns 409 for a later retry. Only one current set is retained per variant: replacement PNGs are written before the atomic metadata commit, then the superseded files are removed. An unsuccessful commit cleans up its own new PNGs and temporary files while retaining the previous durable set.

Cleanup runs when opening the repository and on media access; there is no background worker. Metadata stores the task expiry. Expired rows and their generated files are pruned on access, including an expired task's legacy rows without stored expiry when that task is requested. Restart/access also removes crash orphans in the dedicated `content-media` directory, limited to the generated UUID `.png`, `.png.tmp`, and `assets.json.UUID.tmp` filename conventions. Referenced or in-flight files are protected. Directories, symlinks, unrecognized filenames, original product material, and files outside this exact media directory are not removed. Generated PNGs removed after replacement or expiry can be generated again while the task remains valid.
