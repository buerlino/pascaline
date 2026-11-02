#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Test for ./build.sh --release (A7): each refusal happens before any build step, a good setup passes the guard, and
# tools/release-verify.sh accepts only the pinned certificate. No Gradle, no engine, no network: a fake `npm` in PATH marks
# "the first build step was reached" and stops the build. Run: tools/test-release-guard.sh
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/.." && pwd)"
fails=0; fail() { echo "FAIL: $*" >&2; fails=$((fails + 1)); }
[[ -x "$here/release-verify.sh" ]] || fail "no executable tools/release-verify.sh"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/engine"
printf '#!/usr/bin/env bash\ntouch "$MARK"\nexit 99\n' > "$tmp/bin/npm"; chmod +x "$tmp/bin/npm"
: > "$tmp/ks.jks"
export MARK="$tmp/mark"

# run <name> <expected exit> <message regex or ""> <env assignments...> -- <build.sh args...>
# env assignments: only these variables reach build.sh (env -i plus PATH, HOME, NO_LOCK, MARK)
run() {
  local name="$1" want="$2" re="$3"; shift 3
  local envs=(); while [[ "$1" != -- ]]; do envs+=("$1"); shift; done; shift
  rm -f "$MARK"
  local out rc=0
  out="$(env -i PATH="$tmp/bin:$PATH" HOME="$tmp" NO_LOCK=1 MARK="$MARK" "${envs[@]}" "$root/build.sh" "$@" 2>&1)" || rc=$?
  [[ $rc -eq $want ]] || fail "$name: exit $rc, wanted $want: $out"
  if [[ -n "$re" ]]; then grep -Eq "$re" <<<"$out" || fail "$name: no message matching /$re/: $out"; fi
  if [[ "$want" -ne 99 ]]; then [[ ! -e "$MARK" ]] || fail "$name: a build step ran before the refusal"
  else [[ -e "$MARK" ]] || fail "$name: the guard passed but no build step ran"; fi
}
good=(PASCALINE_KEYSTORE="$tmp/ks.jks" PASCALINE_KEYSTORE_PASS=sp PASCALINE_KEY_ALIAS=pascaline PASCALINE_KEY_PASS=kp)
A=(--release --engine-dir "$tmp/engine")

# 1. a good setup passes the guard and reaches the first build step (the fake npm exits 99)
run "good setup" 99 "" "${good[@]}" -- "${A[@]}"
run "good setup, release tag" 99 "" "${good[@]}" PASCALINE_RELEASE_TAG="v$(sed -n 's/^  "version": *"\([^"]*\)".*/\1/p' "$root/app/package.json" | head -n1)" -- "${A[@]}"

# 2. each of the four variables missing
for v in PASCALINE_KEYSTORE PASCALINE_KEYSTORE_PASS PASCALINE_KEY_ALIAS PASCALINE_KEY_PASS; do
  env_=(); for kv in "${good[@]}"; do [[ "$kv" == "$v="* ]] || env_+=("$kv"); done
  run "$v missing" 1 "$v" "${env_[@]}" -- "${A[@]}"
  env_=(); for kv in "${good[@]}"; do [[ "$kv" == "$v="* ]] && env_+=("$v=") || env_+=("$kv"); done
  run "$v empty" 1 "$v" "${env_[@]}" -- "${A[@]}"
done
run "no variables at all" 1 "PASCALINE_KEYSTORE" -- "${A[@]}"

# 3. keystore file missing; alias throwaway (also with the throwaway keystore's usual password)
run "keystore file missing" 1 "keystore" PASCALINE_KEYSTORE="$tmp/none.jks" PASCALINE_KEYSTORE_PASS=sp PASCALINE_KEY_ALIAS=pascaline PASCALINE_KEY_PASS=kp -- "${A[@]}"
run "alias throwaway" 1 "throwaway" PASCALINE_KEYSTORE="$tmp/ks.jks" PASCALINE_KEYSTORE_PASS=pascaline-throwaway PASCALINE_KEY_ALIAS=throwaway PASCALINE_KEY_PASS=pascaline-throwaway -- "${A[@]}"

# 4. the options that never go with a release
for o in --dev --measure --unsigned --no-units --test --web; do
  run "$o refused" 2 "release.*$o|$o.*release" "${good[@]}" -- "${A[@]}" "$o"
done
# the engine and qalc options stay allowed (the build then reaches the fake npm); an unknown option is still refused
run "--engine-dir allowed" 99 "" "${good[@]}" -- --release --engine-dir "$tmp/engine"

# 5. A48: a tag that is not the version fails before any build step
run "tag mismatch" 1 "tag" "${good[@]}" PASCALINE_RELEASE_TAG=v9.9.9 -- "${A[@]}"
run "malformed tag" 2 "" "${good[@]}" PASCALINE_RELEASE_TAG=nonsense -- "${A[@]}"

# 6. a dev build ignores the release variables (it never signs with the real key)
run "dev build ignores a real alias" 99 "" "${good[@]}" -- --dev --engine-dir "$tmp/engine"

# 7. tools/release-verify.sh with a fake apksigner: the pinned certificate passes, any other deletes the APK
CERT="34:E5:3A:5B:BD:0D:2F:5F:25:EE:B0:FA:A0:33:06:18:DC:64:E0:7C:D1:B7:4E:81:10:D2:0D:88:AD:D0:D9:C0"
digest="$(tr -d ':' <<<"$CERT" | tr 'A-F' 'a-f')"
fake() {   # fake <digest line value>
  printf '#!/usr/bin/env bash\necho "Verified using v2 scheme (APK Signature Scheme v2): true"\necho "Number of signers: 1"\necho "Signer #1 certificate DN: CN=x"\necho "Signer #1 certificate SHA-256 digest: %s"\n' "$1" > "$tmp/apksigner"; chmod +x "$tmp/apksigner"
}
echo "$CERT" > "$tmp/cert.sha256"
verify() { APKSIGNER="$tmp/apksigner" RELEASE_CERT_FILE="${2:-$tmp/cert.sha256}" "$here/release-verify.sh" "$1" 2>&1; }
echo apk > "$tmp/a.apk"; fake "$digest"
out="$(verify "$tmp/a.apk")" || fail "release-verify: the pinned certificate was refused: $out"
[[ -f "$tmp/a.apk" ]] || fail "release-verify: the APK was deleted on a match"
echo apk > "$tmp/b.apk"; fake "$(tr 'a-f0-9' 'b-f0-9a' <<<"$digest")"
if out="$(verify "$tmp/b.apk")"; then fail "release-verify: another certificate passed"; fi
[[ ! -e "$tmp/b.apk" ]] || fail "release-verify: the APK stays after a mismatch"
grep -q 'mismatch' <<<"$out" || fail "release-verify: no mismatch message: $out"
echo apk > "$tmp/c.apk"; echo "not a hash" > "$tmp/bad.sha256"; fake "$digest"
if out="$(verify "$tmp/c.apk" "$tmp/bad.sha256")"; then fail "release-verify: a malformed cert file passed"; fi
echo apk > "$tmp/d.apk"; printf '#!/usr/bin/env bash\nexit 1\n' > "$tmp/apksigner"
if out="$(verify "$tmp/d.apk")"; then fail "release-verify: a failing apksigner passed"; fi
[[ ! -e "$tmp/d.apk" ]] || fail "release-verify: the APK stays after apksigner failed"
# the committed pin is the owner's certificate
[[ "$(tr -d ':\n ' < "$root/android/release-cert.sha256" | tr 'A-F' 'a-f')" == "$digest" ]] || fail "android/release-cert.sha256 is not the owner's certificate"
[[ "$(grep -c . "$root/android/release-cert.sha256")" == 1 ]] || fail "android/release-cert.sha256 is not one line"

[[ $fails -eq 0 ]] || { echo "test-release-guard.sh: $fails failure(s)" >&2; exit 1; }
echo "test-release-guard.sh: ok"
