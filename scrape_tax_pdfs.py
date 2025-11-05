#!/usr/bin/env python3
"""
Scrape tax PDFs from Cook County Clerk API
Default: Downloads PDFs from 2006 to current year
"""
import requests
import json
import os
import sys
from pathlib import Path
from datetime import datetime

# API Configuration
BASE_URL = "https://www.cookcountyclerkil.gov"
API_ENDPOINT = f"{BASE_URL}/api-tax/public/getreportdata"

# Agency IDs to fetch
AGENCIES = [
    "020180000",
    "020180002",
    "020180004",
    "030920000",
    "030920001",
    "040580000",
    "050760000",
    "042020000"
]

def get_report_data(year):
    """Fetch report metadata from API. Returns None if year has no data."""
    payload = {
        "page": 1,
        "itemsPerPage": 10,
        "request": {
            "Year": str(year),
            "ReportTypeId": 1,
            "AgencyTypeId": "0",
            "Agencies": AGENCIES,
            "AgencyName": ""
        }
    }

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        response = requests.post(API_ENDPOINT, json=payload, headers=headers)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"  API error: {e}")
        return None

def download_pdf(agency_id, year, report_type_id, agency_type_id, agencies_list):
    """Download PDF for a specific agency using the viewreport endpoint"""
    endpoint = f"{BASE_URL}/api-tax/public/viewreport"

    payload = {
        "All": False,
        "AgencyType": agency_type_id,
        "ReportTypeId": report_type_id,
        "Year": str(year),
        "Agencies": agencies_list,
        "AgencyName": "",
        "Ignore": False,
        "TaxReports": [
            {
                "agencyId": agency_id,
                "year": year,
                "reportTypeId": report_type_id
            }
        ]
    }

    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }

    try:
        response = requests.post(endpoint, json=payload, headers=headers)
        response.raise_for_status()

        content_type = response.headers.get('content-type', '')
        if 'pdf' in content_type.lower() or response.content.startswith(b'%PDF'):
            return response.content
        else:
            print(f"  Unexpected content-type: {content_type}")
            return None
    except Exception as e:
        print(f"  Failed: {e}")
        return None

def download_reports_for_year(year, base_output_dir):
    """Download all reports for a given year. Skips existing files."""
    print(f"\n{'='*60}")
    print(f"Processing Year: {year}")
    print(f"{'='*60}")

    # Create year-specific directory
    year_dir = base_output_dir / str(year)
    year_dir.mkdir(exist_ok=True)

    # Get report data
    print("Fetching report data...")
    data = get_report_data(year)

    if data is None:
        print(f"⚠ Skipping year {year} - API request failed")
        return 0

    if data.get('totalCount', 0) == 0:
        print(f"⚠ No reports found for year {year}")
        return 0

    print(f"\nFound {data['totalCount']} reports:")
    for report in data['data']:
        print(f"  - {report['agencyName']} ({report['agencyId']})")

    # Get list of all agency IDs for the payload
    agencies_list = [report['agencyId'] for report in data['data']]

    # Try to download PDFs
    print("\n" + "="*60)
    print("Downloading PDFs...")
    print("="*60)

    success_count = 0
    skipped_count = 0
    for report in data['data']:
        agency_id = report['agencyId']
        agency_name = report['agencyName'].strip()
        year = report['year']
        report_type_id = report['reportTypeId']
        agency_type_id = report['agencyTypeId']

        # Check if file already exists
        filename = f"{agency_id}_{agency_name.replace(' ', '_')}_{year}.pdf"
        filepath = year_dir / filename

        if filepath.exists():
            print(f"\n{agency_name} ({agency_id}):")
            print(f"  ⊙ Already exists: {filepath}")
            skipped_count += 1
            continue

        print(f"\n{agency_name} ({agency_id}):")

        pdf_content = download_pdf(agency_id, year, report_type_id, agency_type_id, agencies_list)

        if pdf_content:
            with open(filepath, 'wb') as f:
                f.write(pdf_content)

            print(f"  ✓ Saved to {filepath} ({len(pdf_content):,} bytes)")
            success_count += 1
        else:
            print(f"  ✗ Could not download PDF")

    print(f"\n{'='*60}")
    print(f"Year {year}: {success_count} downloaded, {skipped_count} skipped (already exist)")
    print(f"{'='*60}")

    return success_count

def main():
    # Parse command line arguments
    if len(sys.argv) > 1:
        years = []
        for arg in sys.argv[1:]:
            # Check for range syntax like "2006-2023"
            if '-' in arg and arg.count('-') == 1:
                try:
                    start_year, end_year = map(int, arg.split('-'))
                    years.extend(range(start_year, end_year + 1))
                except ValueError:
                    print(f"Warning: '{arg}' is not a valid year range, skipping")
            else:
                try:
                    years.append(int(arg))
                except ValueError:
                    print(f"Warning: '{arg}' is not a valid year, skipping")
    else:
        # Default: 2006 to current year
        current_year = datetime.now().year
        years = list(range(2006, current_year + 1))

    # Create output directory
    output_dir = Path("tax_pdfs")
    output_dir.mkdir(exist_ok=True)

    print(f"Will download reports for years: {', '.join(map(str, years))}")
    print(f"Total years to process: {len(years)}")

    # Download reports for each year
    total_pdfs = 0
    skipped_years = []
    for year in years:
        count = download_reports_for_year(year, output_dir)
        if count == 0:
            skipped_years.append(year)
        total_pdfs += count

    print("\n" + "="*60)
    print("All downloads complete!")
    print(f"Total PDFs downloaded: {total_pdfs}")
    if skipped_years:
        print(f"Years with no data: {', '.join(map(str, skipped_years))}")
    print("="*60)

if __name__ == "__main__":
    main()
