#!/usr/bin/env python3
"""Fetch ACS median household income for Oak Park, IL.

Data source: US Census Bureau ACS
Variable: B19013_001E (Median household income in the past 12 months)
Geography: place:54885 in state:17 (Oak Park village, Illinois)

Strategy:
  - 2009+: ACS 5-year estimates (most reliable, end-year labeled).
  - 2007, 2008: ACS 3-year estimates (end-year labeled). 3-year was
    discontinued after 2013 but covers places down to 20k pop, so Oak Park
    qualifies. This avoids extrapolating.
  - 2006: no ACS data exists for Oak Park that early (the village is under
    the 65k population cutoff for ACS 1-year, and 3-year/5-year releases
    don't reach back this far). As a placeholder we carry the 2007 value
    back to 2006 (marked "carryback") so the series spans the full tax-data
    range. Readers should treat 2006 as approximate.

Writes income_data.csv with columns: year, median_household_income, source
"""

import csv
import json
import sys
import urllib.request

STATE_FIPS = "17"
PLACE_FIPS = "54885"


def fetch(dataset: str, year: int) -> int | None:
    """Fetch B19013_001E for Oak Park from the given ACS dataset and year."""
    url = (
        f"https://api.census.gov/data/{year}/acs/{dataset}"
        f"?get=B19013_001E&for=place:{PLACE_FIPS}&in=state:{STATE_FIPS}"
    )
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            if resp.status != 200:
                return None
            data = json.load(resp)
    except Exception as e:
        print(f"  {dataset} {year}: fetch failed ({e})", file=sys.stderr)
        return None
    if not isinstance(data, list) or len(data) < 2:
        return None
    value = data[1][0]
    if value in (None, "", "-", "null"):
        return None
    return int(value)


def main() -> None:
    rows: list[tuple[int, int, str]] = []

    # 3-year estimates for 2007 and 2008 (labeled by end year of the window).
    for year in (2007, 2008):
        value = fetch("acs3", year)
        if value is None:
            print(f"  {year}: 3-year not available", file=sys.stderr)
            continue
        rows.append((year, value, "acs3"))
        print(f"  {year} (3yr): ${value:,}", file=sys.stderr)

    # 5-year estimates from 2009 forward.
    for year in range(2009, 2030):
        value = fetch("acs5", year)
        if value is None:
            print(f"  {year}: 5-year not available (stopping)", file=sys.stderr)
            break
        rows.append((year, value, "acs5"))
        print(f"  {year} (5yr): ${value:,}", file=sys.stderr)

    # Carry the 2007 value back to 2006 so the series covers the full tax-data
    # range. No ACS release reaches Oak Park for years before 2007.
    vals = {y: v for y, v, _ in rows}
    if 2007 in vals:
        rows.insert(0, (2006, vals[2007], "carryback-from-2007"))
        print(f"  2006 (carried back from 2007): ${vals[2007]:,}", file=sys.stderr)

    rows.sort(key=lambda r: r[0])

    with open("income_data.csv", "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["year", "median_household_income", "source"])
        writer.writerows(rows)
    print(f"Wrote income_data.csv ({len(rows)} rows)", file=sys.stderr)


if __name__ == "__main__":
    main()
