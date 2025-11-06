#!/usr/bin/env python3
"""Convert tax_data.csv to JavaScript format for embedding in React app."""

import csv
import json

# Read CSV data
import os
import sys

csv_path = sys.argv[1] if len(sys.argv) > 1 else 'tax_data.csv'
data = []
with open(csv_path, 'r') as f:
    reader = csv.DictReader(f)
    for row in reader:
        data.append({
            'year': int(row['year']),
            'agencyCode': row['agency_code'],
            'agencyName': row['agency_name'],
            'eavTotal': float(row['eav_total']),
            'taxAmount': float(row['tax_amount']),
            'taxRate': float(row['tax_rate']),
        })

# Inflation data from CLAUDE.md
inflation_data = {
    2006: 0.0,      # Base year
    2007: 2.8,
    2008: 3.8,
    2009: -0.4,     # Deflation
    2010: 1.6,
    2011: 3.2,
    2012: 2.1,
    2013: 1.5,
    2014: 1.6,
    2015: 0.1,
    2016: 1.3,
    2017: 2.1,
    2018: 2.4,
    2019: 1.8,
    2020: 1.2,
    2021: 4.7,
    2022: 8.0,      # High inflation
    2023: 4.1,
}

# Calculate cumulative inflation multiplier for each year
cumulative = {2006: 1.0}
multiplier = 1.0
for year in range(2007, 2024):
    multiplier *= (1 + inflation_data[year] / 100)
    cumulative[year] = multiplier

# Agency display names (cleaned up)
agency_display_names = {
    'TOWN OAK PARK': 'Oak Park Township',
    'GENERAL ASSISTANCE OAK PARK': 'General Assistance',
    'OAK PARK MENTAL HEALTH DISTRICT': 'Mental Health District',
    'VILLAGE OF OAK PARK': 'Village of Oak Park',
    'VILLAGE OF OAK PARK LIBRARY FUND': 'Village Library Fund',
    'SCHOOL DISTRICT 97': 'School District 97',
    'CONSOLIDATED HIGH SCHOOL 200': 'High School 200',
    'OAK PARK PARK DISTRICT': 'Park District',
}

# Output JavaScript
print('// Tax data for Oak Park, IL (2006-2023)')
print('// Generated from tax_data.csv')
print()
print('export const taxData = ' + json.dumps(data, indent=2) + ';')
print()
print('export const inflationData = ' + json.dumps(inflation_data, indent=2) + ';')
print()
print('export const cumulativeInflation = ' + json.dumps(cumulative, indent=2) + ';')
print()
print('export const agencyDisplayNames = ' + json.dumps(agency_display_names, indent=2) + ';')
print()
print('// Color palette for charts (must be distinct)')
print('export const agencyColors = {')
print('  "Oak Park Township": "#E74C3C",      // Red')
print('  "Village of Oak Park": "#3498DB",    // Blue')
print('  "Village Library Fund": "#7F8C8D",   // Gray')
print('  "School District 97": "#F39C12",     // Orange')
print('  "High School 200": "#9B59B6",        // Purple')
print('  "Park District": "#27AE60",          // Green')
print('  "General Assistance": "#E67E22",     // Dark Orange')
print('  "Mental Health District": "#16A085", // Teal')
print('};')
