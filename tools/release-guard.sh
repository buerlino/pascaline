#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# What ./build.sh --release checks before any build step (A7): the four key variables are set, the keystore file exists, the
# alias is not the throwaway one, and the version files agree (tools/check-version.sh, with PASCALINE_RELEASE_TAG as the tag
# when set). Starts nothing, reads no secret. Exit: 0 ok, 1 refused, 2 usage (a malformed tag).
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bad=0; no() { echo "release: $*" >&2; bad=1; }
for v in PASCALINE_KEYSTORE PASCALINE_KEYSTORE_PASS PASCALINE_KEY_ALIAS PASCALINE_KEY_PASS; do
  [[ -n "${!v:-}" ]] || no "$v is not set (the release key comes from the environment only)"
done
[[ -z "${PASCALINE_KEYSTORE:-}" || -f "$PASCALINE_KEYSTORE" ]] || no "the keystore file PASCALINE_KEYSTORE does not exist: $PASCALINE_KEYSTORE"
[[ "${PASCALINE_KEY_ALIAS:-}" != throwaway ]] || no "the alias is 'throwaway': a release is never signed with the throwaway key"
(( bad )) && exit 1
"$here/check-version.sh" ${PASCALINE_RELEASE_TAG:+"$PASCALINE_RELEASE_TAG"} >&2 || exit $?
