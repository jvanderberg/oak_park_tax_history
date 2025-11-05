#!/usr/bin/env python3
"""
Oak Park Tax Levy Stacked Bar Chart by Agency (2006-2023)
Generates: oak_park_levy_stacked.png
"""
import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

# Set modern style
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica', 'DejaVu Sans']
plt.rcParams['axes.facecolor'] = '#f8f9fa'
plt.rcParams['figure.facecolor'] = 'white'

# Same color palette as other charts
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

results = []
for year in sorted(df['year'].unique()):
    year_data = df[df['year'] == year]
    for group_name, agency_codes in agency_groups.items():
        group_total = year_data[year_data['agency_code'].isin(agency_codes)]['tax_amount'].sum()
        results.append({'year': year, 'group': group_name, 'tax_amount': group_total})

chart_df = pd.DataFrame(results)
pivot_df = chart_df.pivot(index='year', columns='group', values='tax_amount')

# Sort columns by 2023 values (descending) for consistent stacking
final_year_totals = pivot_df.iloc[-1].sort_values(ascending=False)
pivot_df = pivot_df[final_year_totals.index]

# Create stacked bar chart
fig, ax = plt.subplots(figsize=(16, 9))
fig.patch.set_facecolor('white')
ax.set_facecolor('#f8f9fa')

# Plot stacked bars
bottom = np.zeros(len(pivot_df))
bar_width = 0.8

for column in pivot_df.columns:
    values = pivot_df[column] / 1e6  # Convert to millions
    bars = ax.bar(pivot_df.index, values, bar_width,
                   bottom=bottom, label=column,
                   color=COLORS[column], alpha=0.9,
                   edgecolor='white', linewidth=1)
    bottom += values

# Styling
ax.set_xlabel('Year', fontsize=22, fontweight='600', color='#2c3e50')
ax.set_ylabel('Tax Levy (Millions $)', fontsize=22, fontweight='600', color='#2c3e50')
ax.set_title('Oak Park Tax Levy by Agency\nStacked View (2006-2023)',
             fontsize=28, fontweight='700', color='#2c3e50', pad=20)

# Legend
legend = ax.legend(loc='upper left', fontsize=16, frameon=True,
                   facecolor='white', edgecolor='#dee2e6',
                   framealpha=0.95, shadow=True)
legend.get_frame().set_linewidth(1.5)

# Grid
ax.grid(True, alpha=0.3, axis='y', linestyle='--', linewidth=0.8, color='#95a5a6')
ax.set_axisbelow(True)

# Spines
for spine in ax.spines.values():
    spine.set_color('#dee2e6')
    spine.set_linewidth(1.5)

# Y-axis formatting
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:.0f}M'))
ax.tick_params(axis='both', labelsize=16)

# X-axis
ax.set_xticks(pivot_df.index)
ax.set_xticklabels(pivot_df.index, rotation=45, ha='right')

plt.tight_layout()
plt.savefig('oak_park_levy_stacked.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: oak_park_levy_stacked.png")
