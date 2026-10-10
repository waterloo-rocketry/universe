#!/usr/bin/env bash
# Wait for every other check run on a commit to finish, then fail if any of
# them did not succeed. Run by .github/workflows/required.yml: per-project
# workflows only run when their area changes, so none of them can be a
# required check on their own; this one always runs and stands in for all.
#
# Env: GH_TOKEN, REPO (owner/name), SHA (commit), SELF (this check's name),
#      SETTLE (seconds to let path-filtered workflows start, default 30),
#      POLL (seconds between polls, default 20).
set -euo pipefail

sleep "${SETTLE:-30}"
while true; do
  runs=$(gh api --paginate "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
    --jq ".check_runs[] | select(.name != \"$SELF\") | [.name, .status, (.conclusion // \"\")] | @tsv")
  pending=$(awk -F'\t' '$2 != "completed"' <<<"$runs")
  [[ -z "$pending" ]] && break
  echo "Waiting on: $(cut -f1 <<<"$pending" | paste -sd, -)"
  sleep "${POLL:-20}"
done

echo "Checks on $SHA:"
if [[ -n "$runs" ]]; then awk -F'\t' '{printf "  %-12s %s\n", $3, $1}' <<<"$runs"; else echo "  (none)"; fi

failed=$(awk -F'\t' '$3 != "success" && $3 != "skipped" && $3 != "neutral"' <<<"$runs")
if [[ -n "$failed" ]]; then
  echo "::error::Failed checks: $(cut -f1 <<<"$failed" | paste -sd, -)"
  exit 1
fi
echo "All checks passed."
