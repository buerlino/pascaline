#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# What ./build.sh --release checks before any build step (A7): the four key variables are set, the keystore file exists, the
# alias is not the throwaway one, and the version files agree (tools/check-version.sh, with N62_RELEASE_TAG as the tag
# when set: vX.Y.Z or a test tag vX.Y.Z-<suffix>, X.Y.Z compared). Starts nothing, reads no secret. Exit: 0 ok, 1 refused, 2 usage (a malformed tag).
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bad=0; no() { echo "release: $*" >&2; bad=1; }
for v in N62_KEYSTORE N62_KEYSTORE_PASS N62_KEY_ALIAS N62_KEY_PASS; do
  [[ -n "${!v:-}" ]] || no "$v is not set (the release key comes from the environment only)"
done
[[ -z "${N62_KEYSTORE:-}" || -f "$N62_KEYSTORE" ]] || no "the keystore file N62_KEYSTORE does not exist: $N62_KEYSTORE"
[[ "${N62_KEY_ALIAS:-}" != throwaway ]] || no "the alias is 'throwaway': a release is never signed with the throwaway key"
(( bad )) && exit 1
"$here/check-version.sh" ${N62_RELEASE_TAG:+"$N62_RELEASE_TAG"} >&2 || exit $?
