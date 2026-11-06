# Releasing Pascaline: the owner's checklist (A8)

A tag `vX.Y.Z` pushed to GitHub runs [`.github/workflows/release.yml`](../.github/workflows/release.yml): the version check, the engine and
libqalculate in the pinned container (P2), the golden gate on that engine, then the APK signed with your key (`./build.sh --release`, A7,
which checks its certificate against [`android/release-cert.sha256`](../android/release-cert.sha256)) and a GitHub release with
`n62-X.Y.Z.apk` and its `.sha256`. While the major version is 0, or when the tag holds a `-`, the release is a pre-release.
The same tag deploys the website ([`pages.yml`](../.github/workflows/pages.yml)); a tag with a `-` does not (below). The bar for v0.1.0:
[release-0.1.0.md](release-0.1.0.md).

The four secrets (Settings → Secrets and variables → Actions, set once; A7): `KEYSTORE_BASE64` (`base64 -w0 release.jks`),
`KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`. Only the build step sees them; the keystore is deleted after it, pass or fail.

## 1. Bump the version (one commit on phase-1)
- `app/package.json` `"version"` (and the same line at the top of `app/package-lock.json`), `android/app/build.gradle` `versionName` and
  `versionCode` (one more than the last release; both stay plain literals), and the F-Droid draft `fdroid/dev.n62.calc.yml`:
  a new `Builds` entry with that `versionName`, `versionCode` and `commit: vX.Y.Z`, and `CurrentVersion` / `CurrentVersionCode`.
- `tools/check-version.sh vX.Y.Z` prints `check-version: ok X.Y.Z (<code>), tag vX.Y.Z`. Commit (`git commit -s`).
- A test tag needs no bump: `vX.Y.Z-test` (suffix of letters, digits and dots) is checked against the current X.Y.Z.

## 2. Push phase-1 and master, then the tag
```bash
git push origin phase-1 phase-1:master        # master follows phase-1 (2026-11-03): a fast-forward, refused otherwise
git tag -s vX.Y.Z -m "N62 vX.Y.Z"             # on the bump commit; -a instead of -s for an unsigned tag
git push origin vX.Y.Z
```

## 3. Watch the run
GitHub → Actions → **release** (the run named after the tag). The steps in order: one version, the tarballs, the release engine, the
release libqalculate, the checksums, the golden gate (its log ends in `GOLDEN GATE PASSED`), the signed APK, the keystore deleted, the
release. A release tag also starts **pages**, which deploys https://n62.dev/ after its own golden gate.

## 4. Check what was published
From the release page download `n62-X.Y.Z.apk` and `n62-X.Y.Z.apk.sha256` into one folder, then:
```bash
sha256sum -c n62-X.Y.Z.apk.sha256            # n62-X.Y.Z.apk: OK
apksigner verify --print-certs n62-X.Y.Z.apk  # one signer; its SHA-256 digest is android/release-cert.sha256
cp n62-X.Y.Z.apk /tmp/check.apk && tools/release-verify.sh /tmp/check.apk   # the same comparison (it deletes the file on a mismatch)
```
`apksigner` prints the digest in lower case without colons (`Signer #1 certificate SHA-256 digest:` up to build-tools 36, `V2 Signer:
certificate SHA-256 digest:` from 37; never the `public key` line); `release-verify.sh` reads both and compares both forms. The release notes repeat the
commit, the certificate and both `SHA256SUMS`.

## 5. Install over the last release
`adb install -r n62-X.Y.Z.apk` keeps the app's data when the last install was signed with the same key (a release). Over a dev build
(the throwaway key) Android refuses: uninstall first, which deletes the app's data.

## 6. A test tag (`vX.Y.Z-test`)
The release run makes a pre-release; the pages run skips its build and deploy (a tag push with a `-`). To put the test build on the website
anyway: Actions → **pages** → Run workflow, ref the tag (it stays until the next release tag deploys). Afterwards delete the test release
in the web UI and the tag: `git push origin :refs/tags/vX.Y.Z-test && git tag -d vX.Y.Z-test`.

## 7. A failed run
Nothing is published: the release is the last step, and the keystore step runs `if: always()`. Only `gh release create` itself can leave
something behind (a draft release when an upload failed): delete it in the web UI. Then:
- **The runner failed** (network, a timeout): the run's page → Re-run all jobs, or Actions → release → Run workflow with the tag.
- **The code failed** (version check, golden gate, certificate): fix it on phase-1, delete the tag (`git push origin :refs/tags/vX.Y.Z`,
  `git tag -d vX.Y.Z`), and tag the fixed commit (from step 2; a fix after the bump commit keeps the version).
- A run on a tag that already has a release stops at the last step (`gh` refuses): delete that release first.
