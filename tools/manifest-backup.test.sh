#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A23: Android's backup must be off (decisions.md S8); our own backup file moves data (S6).
set -euo pipefail
M="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/android/app/src/main/AndroidManifest.xml"
grep -q 'android:allowBackup="false"' "$M" || { echo "FAIL: $M lacks android:allowBackup=\"false\"" >&2; exit 1; }
if grep -q 'dataExtractionRules\|fullBackupContent' "$M"; then echo "FAIL: backup rules present although backup is off" >&2; exit 1; fi
echo "ok: allowBackup=false"
