#!/usr/bin/env python3
"""
Oak Park Tax Levy Breakdown by Agency (2023)
Generates: oak_park_levy_breakdown.png
"""
import pandas as pd
import matplotlib.pyplot as plt

# Set modern style
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica', 'DejaVu Sans']
plt.rcParams['figure.facecolor'] = 'white'

# Same color palette as history chart
COLORS = {
    'Oak Park Township': '#E74C3C',      # Red
    'Village of Oak Park': '#3498DB',    # Blue
    'Village Library Fund': '#7F8C8D',   # Gray
    'School District 97': '#F39C12',     # Orange
    'High School 200': '#9B59B6',        # Purple
    'Park District': '#27AE60'           # Green
}

# Define agency groupings
agency_groups = {
    'Oak Park Township': ['02-0180-000', '02-0180-002', '02-0180-004'],
    'Village of Oak Park': ['03-0920-000'],
    'Village Library Fund': ['03-0920-001'],
    'School District 97': ['04-0580-000'],
    'High School 200': ['04-2020-000'],
    'Park District': ['05-0760-000']
}

# Read and process data
df = pd.read_csv('tax_data.csv')
df['year'] = pd.to_numeric(df['year'])
df['tax_amount'] = pd.to_numeric(df['tax_amount'])

# Get 2023 data
year_2023 = df[df['year'] == 2023]

results = []
for group_name, agency_codes in agency_groups.items():
    group_total = year_2023[year_2023['agency_code'].isin(agency_codes)]['tax_amount'].sum()
    results.append({'group': group_name, 'tax_amount': group_total})

chart_df = pd.DataFrame(results).sort_values('tax_amount', ascending=False)

# Create pie chart
fig, ax = plt.subplots(figsize=(14, 10))
fig.patch.set_facecolor('white')

colors = [COLORS[group] for group in chart_df['group']]

wedges, texts, autotexts = ax.pie(
    chart_df['tax_amount'],
    labels=chart_df['group'],
    colors=colors,
    autopct='%1.1f%%',
    startangle=90,
    textprops={'fontsize': 16, 'fontweight': '600'},
    pctdistance=0.85
)

# Style percentage labels
for autotext in autotexts:
    autotext.set_color('white')
    autotext.set_fontsize(18)
    autotext.set_fontweight('700')

# Style agency labels
for text in texts:
    text.set_fontsize(16)
    text.set_fontweight('600')
    text.set_color('#2c3e50')

# Title
ax.set_title('Oak Park Tax Levy Breakdown by Agency\n2023',
             fontsize=28, fontweight='700', color='#2c3e50', pad=30)

plt.tight_layout()
plt.savefig('oak_park_levy_breakdown.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: oak_park_levy_breakdown.png")
