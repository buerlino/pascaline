#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# The signed release APK carries the owner's certificate (A7): `apksigner verify --print-certs` must show exactly one signer
# certificate whose SHA-256 equals android/release-cert.sha256 (keytool's form with colons; apksigner prints lower case without
# them, so both are normalised). apksigner 35 and 36 print `Signer #1 certificate SHA-256 digest: <hex>`, 37 prints
# `V2 Signer: certificate SHA-256 digest: <hex>` (one line per scheme, A8f2): every line with `certificate SHA-256 digest:`
# counts whatever its prefix, a `public key SHA-256 digest` line never does, and the distinct values must be exactly one.
# On any other outcome the APK is deleted and the exit code is 1.
#   tools/release-verify.sh <apk>      # APKSIGNER=<path> and RELEASE_CERT_FILE=<file> override the defaults (tools/test-release-guard.sh)
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
apk="${1:?usage: release-verify.sh <apk>}"
die() { echo "release-verify: $*" >&2; rm -f "$apk"; exit 1; }
norm() { tr -d ': \t\r\n' | tr 'A-F' 'a-f'; }
certfile="${RELEASE_CERT_FILE:-$here/../android/release-cert.sha256}"
[[ -f "$certfile" ]] || die "no $certfile"
want="$(norm < "$certfile")"
[[ "$want" =~ ^[0-9a-f]{64}$ ]] || die "$certfile does not hold one SHA-256 (64 hex digits)"
signer="${APKSIGNER:-}"
if [[ -z "$signer" ]]; then
  signer="$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/*/apksigner 2>/dev/null | sort -V | tail -n1)"
  [[ -n "$signer" ]] || die "no apksigner under ${ANDROID_HOME:-$HOME/Android/Sdk}/build-tools"
fi
out="$("$signer" verify --print-certs "$apk" 2>&1)" || die "apksigner verify failed: $out"
mapfile -t got < <(grep -v 'public key' <<<"$out" | sed -n 's/^.*certificate SHA-256 digest: *//p' |
  while IFS= read -r v; do norm <<<"$v"; echo; done | sort -u)
(( ${#got[@]} == 1 )) || die "${#got[@]} signer certificates in the APK (one wanted)"
have="${got[0]}"
[[ "$have" == "$want" ]] || die "certificate mismatch: the APK has $have, android/release-cert.sha256 has $want"
echo "release-verify: certificate $have ok" >&2
