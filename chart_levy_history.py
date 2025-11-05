#!/usr/bin/env python3
"""
Oak Park Tax Levy Historical Trends (2006-2023)
Generates: oak_park_levy_by_year.png
"""
import pandas as pd
import matplotlib.pyplot as plt

# Set modern style
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica', 'DejaVu Sans']
plt.rcParams['axes.facecolor'] = '#f8f9fa'
plt.rcParams['figure.facecolor'] = 'white'

# Distinct color palette - clearly different colors for each agency
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

# Create chart
fig, ax = plt.subplots(figsize=(16, 9))
fig.patch.set_facecolor('white')
ax.set_facecolor('#f8f9fa')

# Plot lines
for column in pivot_df.columns:
    ax.plot(pivot_df.index, pivot_df[column] / 1e6,
            marker='o', linewidth=3.5, label=column,
            color=COLORS[column], markersize=7, markeredgewidth=0, alpha=0.9)

# Styling
ax.set_xlabel('Year', fontsize=22, fontweight='600', color='#2c3e50')
ax.set_ylabel('Tax Levy (Millions $)', fontsize=22, fontweight='600', color='#2c3e50')
ax.set_title('Oak Park Tax Levy Trends by Agency\n2006-2023',
             fontsize=28, fontweight='700', color='#2c3e50', pad=20)

# Legend
legend = ax.legend(loc='upper left', fontsize=16, frameon=True,
                   facecolor='white', edgecolor='#dee2e6',
                   framealpha=0.95, shadow=True)
legend.get_frame().set_linewidth(1.5)

# Grid
ax.grid(True, alpha=0.3, linestyle='--', linewidth=0.8, color='#95a5a6')
ax.set_axisbelow(True)

# Spines
for spine in ax.spines.values():
    spine.set_color('#dee2e6')
    spine.set_linewidth(1.5)

# Y-axis formatting
ax.yaxis.set_major_formatter(plt.FuncFormatter(lambda x, p: f'${x:.0f}M'))
ax.tick_params(axis='both', labelsize=16)

# X-axis
plt.xticks(pivot_df.index, rotation=45, ha='right')

plt.tight_layout()
plt.savefig('oak_park_levy_by_year.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: oak_park_levy_by_year.png")
