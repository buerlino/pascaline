<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
# logo/

- `*.afdesign`: the editable sources (Affinity Designer) of every image here; edit these, then export.
- `android_logo/pascaline_back.svg` and `pascaline_front.svg`: the app icon's two layers; `app/scripts/gen-icons.mjs` builds the app icons and splash screens from them.
- `fdroid/`: the sources of the store icon and banner, exported to `fastlane/metadata/android/en-US/images/icon.png` and `featureGraphic.png` (where F-Droid reads them).
- `github_social_card/`, `monochrome/`, `wordmark/`: the repo's social card, a one-colour mark and the name set in type (light and dark).
