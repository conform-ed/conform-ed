#!/usr/bin/env bash
set -euo pipefail

LRS_BASE_URL="${LRS_BASE_URL:-http://localhost:${LRSQL_PORT:-8080}/xapi}"
LRS_USERNAME="${LRS_USERNAME:-${LRSQL_API_KEY_DEFAULT:-janedoe}}"
LRS_PASSWORD="${LRS_PASSWORD:-${LRSQL_API_SECRET_DEFAULT:-supersecret}}"
LRS_SPEC_VERSIONS="${LRS_SPEC_VERSIONS:-1.0.3,2.0.0}"
LRS_TIMEOUT_SECONDS="${LRS_TIMEOUT_SECONDS:-60}"
LRS_TOTAL_TIMEOUT_SECONDS="${LRS_TOTAL_TIMEOUT_SECONDS:-300}"
LRS_RUN_OUT_DIR="${LRS_RUN_OUT_DIR:-tmp/agents}"

if [[ -z "${LRS_BASE_URL}" ]]; then
  echo "LRS_BASE_URL is required." >&2
  exit 1
fi

if [[ ( -n "${LRS_USERNAME}" && -z "${LRS_PASSWORD}" ) || ( -z "${LRS_USERNAME}" && -n "${LRS_PASSWORD}" ) ]]; then
  echo "Provide both LRS_USERNAME and LRS_PASSWORD together." >&2
  exit 1
fi

mkdir -p "${LRS_RUN_OUT_DIR}"

IFS=',' read -r -a version_list <<< "${LRS_SPEC_VERSIONS}"
start_epoch="$(date +%s)"

for raw_version in "${version_list[@]}"; do
  version="$(echo "${raw_version}" | xargs)"
  if [[ -z "${version}" ]]; then
    continue
  fi

  now_epoch="$(date +%s)"
  elapsed=$((now_epoch - start_epoch))
  if (( elapsed >= LRS_TOTAL_TIMEOUT_SECONDS )); then
    echo "Total timeout exceeded before running ${version} (${elapsed}s >= ${LRS_TOTAL_TIMEOUT_SECONDS}s)." >&2
    exit 124
  fi

  out_file="${LRS_RUN_OUT_DIR}/lrs-run-${version}.json"

  command=(
    bun
    dist/cli.js
    run
    --base-url
    "${LRS_BASE_URL}"
    --version
    "${version}"
  )

  if [[ -n "${LRS_USERNAME}" ]]; then
    command+=(--username "${LRS_USERNAME}" --password "${LRS_PASSWORD}")
  fi

  echo "Running LRS suite for version ${version} (timeout ${LRS_TIMEOUT_SECONDS}s)..."
  timeout --preserve-status "${LRS_TIMEOUT_SECONDS}" "${command[@]}" | tee "${out_file}"
done
