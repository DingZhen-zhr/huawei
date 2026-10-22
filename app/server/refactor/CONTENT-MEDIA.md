# Official image layout runtime

PNG output uses Sharp/Pango and an actual Chinese font file. The renderer parses the file, requires the configured face to exist in it, and verifies Chinese glyph coverage (including the Chinese text to render). Missing, invalid, mismatched, or non-Chinese fonts produce failed assets with a sales-friendly configuration message; Pango fallback is not accepted as proof of a valid font.

Windows defaults to `C:/Windows/Fonts/msyh.ttc` / `Microsoft YaHei`, verified in this workspace. An explicit configuration also works:

```powershell
$env:HC_CJK_FONT_PATH = 'C:/Windows/Fonts/msyh.ttc'
$env:HC_CJK_FONT_FAMILY = 'Microsoft YaHei'
```

On Linux install Noto CJK (for example Debian/Ubuntu `fonts-noto-cjk`) and provide its actual font path and family. Recognized default locations include `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc` with family `Noto Sans CJK SC`. Other installations must set `HC_CJK_FONT_PATH` and `HC_CJK_FONT_FAMILY` to the installed file and one of its real face names. Linux deployment has not been verified by this Windows run; run the image tests and visually inspect Chinese PNG output on the target host before release.

All image gates verify the common media payload: the text copy, actual rendered title/subtitle, body/script, summary, CTA, tags, shot list, limitations, and image-plan overlay text. Generation, downloading existing images, and ZIP export use that gate. The `official-layout-v2` rule version invalidates images generated before this complete-payload gate.
