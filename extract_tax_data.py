#!/usr/bin/env python3
"""
Extract tax data from PDF reports and generate CSV
"""
import re
import csv
from pathlib import Path
import PyPDF2

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file"""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            return text
    except Exception as e:
        print(f"Error reading {pdf_path}: {e}")
        return None

def parse_pdf_data(pdf_path):
    """Extract relevant data from a tax report PDF"""
    text = extract_text_from_pdf(pdf_path)
    if not text:
        return None

    # Extract year from PDF content (line like "DATE 06/24/24 TAX YEAR 2023")
    year_match = re.search(r'TAX YEAR\s+(\d{4})', text)
    year_from_pdf = year_match.group(1) if year_match else None

    # Get year from filename for validation
    filename_parts = pdf_path.stem.split('_')
    year_from_filename = filename_parts[-1] if filename_parts[-1].isdigit() else None

    # Get year from directory name for validation
    parent_name = pdf_path.parent.name
    year_from_dir = parent_name if parent_name.isdigit() else None

    # Use year from PDF, but validate it matches filename/directory
    year = year_from_pdf
    if year_from_filename and year_from_pdf and year_from_filename != year_from_pdf:
        print(f"  Warning: Year mismatch - PDF says {year_from_pdf}, filename says {year_from_filename}")
    if year_from_dir and year_from_pdf and year_from_dir != year_from_pdf:
        print(f"  Warning: Year mismatch - PDF says {year_from_pdf}, directory says {year_from_dir}")

    data = {
        'filename': pdf_path.name,
        'year': year,
        'agency_code': None,
        'agency_name': None,
        'eav_total': None,
        'tax_amount': None,
        'tax_rate': None
    }

    # Extract agency code and name from line like "AGENCY 02-0180-000 TOWN OAK PARK"
    agency_match = re.search(r'AGENCY\s+([\d-]+)\s+(.+?)(?:\n|CURR|PRIOR)', text)
    if agency_match:
        data['agency_code'] = agency_match.group(1).strip()
        # Remove extra spaces from agency name
        data['agency_name'] = re.sub(r'\s+', ' ', agency_match.group(2).strip())

    # Extract EAV total from "AGENCY OVERALL EAV ... TOTAL 2,361,857,488"
    eav_match = re.search(r'AGENCY OVERALL EAV\s+[\d,]+\s+TOTAL\s+([\d,]+)', text)
    if eav_match:
        data['eav_total'] = eav_match.group(1).replace(',', '')

    # Extract tax amount and rate from two sources:
    # 1. Tax rate from "AGENCY GRAND TOTAL" line (last number)
    # 2. Tax extension from "TAX EXTENSION GRAND TOTAL" line (the actual amount collected)

    # Get the final tax rate from AGENCY GRAND TOTAL line
    grand_total_match = re.search(r'AGENCY GRAND TOTAL\s+[\d,]+.*?([\d.]+)\s*$', text, re.MULTILINE)
    if grand_total_match:
        data['tax_rate'] = grand_total_match.group(1).strip()

    # Get the actual tax extension (what's collected) from "TAX EXTENSION GRAND TOTAL"
    # Format: "2023 TAX EXTENSION GRAND TOTAL 99,009,065.90"
    tax_extension_match = re.search(r'TAX EXTENSION GRAND TOTAL\s+([\d,]+\.?\d*)', text)
    if tax_extension_match:
        data['tax_amount'] = tax_extension_match.group(1).replace(',', '')

    return data

def main():
    # Find all PDF files
    tax_pdfs_dir = Path("tax_pdfs")
    pdf_files = sorted(tax_pdfs_dir.glob("**/*.pdf"))

    print(f"Found {len(pdf_files)} PDF files to process...")

    # Extract data from all PDFs
    all_data = []
    errors = []

    for pdf_file in pdf_files:
        print(f"Processing {pdf_file}...")
        data = parse_pdf_data(pdf_file)

        if data and all([data['agency_code'], data['agency_name'], data['eav_total'],
                        data['tax_amount'], data['tax_rate']]):
            all_data.append(data)
        else:
            errors.append(pdf_file)
            print(f"  Warning: Could not extract all data from {pdf_file}")

    # Adjust High School District 200 (04-2020-000) levy based on Oak Park's share of EAV
    # D200 serves multiple communities, so we need to prorate by Oak Park's EAV
    for year_data in set([d['year'] for d in all_data]):
        year_records = [d for d in all_data if d['year'] == year_data]

        # Find D200 and Oak Park EAV records for this year
        d200_record = next((d for d in year_records if d['agency_code'] == '04-2020-000'), None)
        # Get Oak Park EAV from any other Oak Park agency (they should all have the same EAV)
        oak_park_eav_record = next((d for d in year_records if d['agency_code'] in ['02-0180-000', '03-0920-000', '04-0580-000']), None)

        if d200_record and oak_park_eav_record:
            d200_total_eav = float(d200_record['eav_total'])
            oak_park_eav = float(oak_park_eav_record['eav_total'])

            # Calculate Oak Park's share of D200's total EAV
            oak_park_share = oak_park_eav / d200_total_eav

            # Adjust D200's tax amount to only Oak Park's share
            original_tax_amount = float(d200_record['tax_amount'])
            adjusted_tax_amount = original_tax_amount * oak_park_share

            # Update the record
            d200_record['tax_amount'] = str(adjusted_tax_amount)
            d200_record['eav_total'] = oak_park_eav_record['eav_total']  # Use Oak Park's EAV

            # Recalculate tax rate based on adjusted levy and Oak Park EAV
            adjusted_tax_rate = (adjusted_tax_amount / oak_park_eav) * 100
            d200_record['tax_rate'] = str(adjusted_tax_rate)

            print(f"  Adjusted D200 for year {year_data}: {oak_park_share:.1%} of total EAV")
            print(f"    Original: ${original_tax_amount:,.2f}, Adjusted: ${adjusted_tax_amount:,.2f}")

    # Write to CSV
    output_file = Path("tax_data.csv")

    with open(output_file, 'w', newline='') as csvfile:
        fieldnames = ['year', 'agency_code', 'agency_name', 'eav_total', 'tax_amount', 'tax_rate', 'filename']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

        writer.writeheader()
        for data in all_data:
            writer.writerow(data)

    print(f"\n{'='*60}")
    print(f"Successfully processed: {len(all_data)} PDFs")
    print(f"Errors: {len(errors)} PDFs")
    print(f"Output written to: {output_file}")
    print(f"{'='*60}")

    if errors:
        print("\nFiles with errors:")
        for error_file in errors:
            print(f"  - {error_file}")

if __name__ == "__main__":
    main()
