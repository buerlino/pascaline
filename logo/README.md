<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# logo/

The N62 logo. The wordmark and the banner are set in Comic Neue (SIL OFL-1.1), as outlines, so no font file ships.

- `*/n62*.afdesign`: the editable sources (Affinity Designer) of every image here; edit these, then export.
- `android_logo/n62_back.svg` and `n62_front.svg`: the app icon's two layers (108×108, solid background and mark); `app/scripts/gen-icons.mjs` builds the app icons and splash screens from them.
- `fdroid/n62_fdroid_banner.png`: the store banner (1024×500), copied to `fastlane/metadata/android/en-US/images/featureGraphic.png` (where F-Droid reads it). The store icon (`images/icon.png`, 512×512) is exported by the owner from the icon source.
- `github_social_card/n62_github_social.png`: the repo's social card (1280×640).
- `monochrome/n62_monochrome.svg`: a one-colour mark.
- `wordmark/n62_wordmark_dark.svg` and `n62_wordmark_light.svg`: the name set in type, for light and for dark backgrounds (the README picks one by theme).
