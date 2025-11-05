#!/usr/bin/env python3
"""
Oak Park Tax Growth vs. Inflation Comparison (2006-2023)
Generates: oak_park_total_increase_real_inflation.png
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

# Historical inflation data
inflation_rates = {
    2006: 3.2, 2007: 2.8, 2008: 3.8, 2009: -0.4, 2010: 1.6,
    2011: 3.2, 2012: 2.1, 2013: 1.5, 2014: 1.6, 2015: 0.1,
    2016: 1.3, 2017: 2.1, 2018: 2.4, 2019: 1.8, 2020: 1.2,
    2021: 4.7, 2022: 8.0, 2023: 4.1
}

cumulative_inflation = 1.0
for year in range(2007, 2024):
    cumulative_inflation *= (1 + inflation_rates[year] / 100)
cumulative_inflation_pct = (cumulative_inflation - 1) * 100

baseline_year = 2006
end_year = 2023
years_elapsed = end_year - baseline_year

summary_data = []
for group_name in agency_groups.keys():
    group_data = chart_df[chart_df['group'] == group_name].sort_values('year')
    baseline = group_data[group_data['year'] == baseline_year]['tax_amount'].values[0]
    final = group_data[group_data['year'] == end_year]['tax_amount'].values[0]
    cumulative_pct = ((final - baseline) / baseline) * 100
    cagr = (np.power(final / baseline, 1/years_elapsed) - 1) * 100
    real_growth = cumulative_pct - cumulative_inflation_pct

    # Color based on inflation comparison
    if cumulative_pct > cumulative_inflation_pct:
        color = '#d62728'  # Red for above inflation
    else:
        color = '#2ca02c'  # Green for below inflation

    summary_data.append({
        'group': group_name,
        'cumulative_pct': cumulative_pct,
        'cagr': cagr,
        'real_growth': real_growth,
        'color': color
    })

summary_df = pd.DataFrame(summary_data).sort_values('cumulative_pct', ascending=True)

# Create chart
fig, ax = plt.subplots(figsize=(14, 9))
fig.patch.set_facecolor('white')
ax.set_facecolor('#f8f9fa')

# Create bars
bars = ax.barh(summary_df['group'], summary_df['cumulative_pct'],
               color=summary_df['color'], alpha=0.85, edgecolor='white', linewidth=2)

# Add value labels
for i, (bar, pct, cagr) in enumerate(zip(bars, summary_df['cumulative_pct'], summary_df['cagr'])):
    if pct > 80:
        x_pos = pct - 5
        ha = 'right'
        color = 'white'
    else:
        x_pos = pct + 3
        ha = 'left'
        color = '#2c3e50'

    ax.text(x_pos, bar.get_y() + bar.get_height()/2,
            f'{pct:.1f}%\n({cagr:.1f}% annual)',
            va='center', ha=ha, fontsize=13, fontweight='600', color=color)

# Inflation reference line
ax.axvline(x=cumulative_inflation_pct, color='#e74c3c', linestyle='--',
           linewidth=3, alpha=0.7, label=f'Inflation: {cumulative_inflation_pct:.1f}%')

# Styling
ax.set_xlabel('Cumulative Growth (2006-2023)', fontsize=16, fontweight='600', color='#2c3e50')
ax.set_title('Tax Levy Growth vs. Inflation\nCumulative % Increase & Annual Growth Rate (CAGR)',
             fontsize=20, fontweight='700', color='#2c3e50', pad=20)

# Legend
legend = ax.legend(loc='lower right', fontsize=13, frameon=True,
                   facecolor='white', edgecolor='#dee2e6', framealpha=0.95, shadow=True)
legend.get_frame().set_linewidth(1.5)

# Grid
ax.grid(True, alpha=0.3, axis='x', linestyle='--', linewidth=0.8, color='#95a5a6')
ax.set_axisbelow(True)

# Spines
for spine in ax.spines.values():
    spine.set_color('#dee2e6')
    spine.set_linewidth(1.5)

# Add annotation box
textstr = 'Green zone = Below inflation\nRed zone = Above inflation'
props = dict(boxstyle='round,pad=0.8', facecolor='white', edgecolor='#dee2e6',
             linewidth=1.5, alpha=0.95)
ax.text(0.02, 0.98, textstr, transform=ax.transAxes, fontsize=12,
        verticalalignment='top', bbox=props, color='#2c3e50', fontweight='500')

# Y-axis tick label size
ax.tick_params(axis='both', labelsize=12)

plt.tight_layout()
plt.savefig('oak_park_total_increase_real_inflation.png', dpi=300, bbox_inches='tight', facecolor='white')
print("✓ Chart saved: oak_park_total_increase_real_inflation.png")
