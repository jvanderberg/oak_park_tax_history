# Tax Data Analysis Project - Technical Notes

## Data Sources

### Cook County Clerk API
- **Base URL**: `https://www.cookcountyclerkil.gov`
- **Endpoints**:
  - `/api-tax/public/getreportdata` - Fetch report metadata
  - `/api-tax/public/viewreport` - Download PDF reports

### Agency Codes
Oak Park agencies tracked:
- Township: `02-0180-000`, `02-0180-002`, `02-0180-004`
- Village: `03-0920-000`
- Library: `03-0920-001`
- School District 97: `04-0580-000`
- High School 200: `04-2020-000`
- Park District: `05-0760-000`

## Data Extraction Rules

### Tax Amount Source
**CRITICAL**: Extract from "TAX EXTENSION GRAND TOTAL" in PDFs, NOT "AGENCY GRAND TOTAL"
- Tax Extension = actual amount collected after PTELL reductions
- Agency Grand Total = requested levy amount (higher than actual)

### High School District 200 Adjustment
**CRITICAL**: District 200 serves multiple communities, not just Oak Park
- Must calculate Oak Park's proportional share based on EAV
- Oak Park's share typically 72-76% of total D200 EAV
- Formula: `oak_park_share = oak_park_eav / d200_total_eav`
- Apply to both tax amount and tax rate

### Inflation Calculations
Use actual historical CPI data, not flat estimates:
- Historical inflation rates by year (2006-2023)
- 2009: -0.4% (deflation)
- 2022: 8.0% (high inflation)
- Cumulative 2006-2023: 50.8%

### CAGR Formula
Compound Annual Growth Rate: `(Final/Initial)^(1/years) - 1`

## Chart Styling Standards

### Color Palette (Must be distinct)
```python
COLORS = {
    'Oak Park Township': '#E74C3C',      # Red
    'Village of Oak Park': '#3498DB',    # Blue
    'Village Library Fund': '#7F8C8D',   # Gray
    'School District 97': '#F39C12',     # Orange
    'High School 200': '#9B59B6',        # Purple
    'Park District': '#27AE60'           # Green
}
```

**IMPORTANT**: Colors must be clearly distinguishable - avoid similar hues like teal/green or light/dark versions of same color.

### Font Sizes (Large and readable)
- Title: 28pt
- Axis labels: 22pt
- Legend: 16pt
- Tick labels: 16pt
- Chart annotations: 13-18pt

### Style Framework
```python
plt.style.use('seaborn-v0_8-darkgrid')
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['font.sans-serif'] = ['Arial', 'Helvetica', 'DejaVu Sans']
plt.rcParams['axes.facecolor'] = '#f8f9fa'
plt.rcParams['figure.facecolor'] = 'white'
```

## File Organization

### Scripts (One per chart)
- `scrape_tax_pdfs.py` - Download PDFs from API
- `extract_tax_data.py` - Parse PDFs to CSV
- `chart_levy_history.py` - Line chart by agency over time
- `chart_growth_comparison.py` - Bar chart vs inflation
- `chart_levy_breakdown.py` - Pie chart of 2023 percentages

### Data Files
- `tax_data.csv` - Extracted data (144 rows: 8 agencies × 18 years)
- `tax_pdfs/YYYY/*.pdf` - Downloaded PDFs organized by year

## Common Errors and Fixes

### Duplicate Data
**Problem**: PDFs in both root and year directories causing doubled values
**Solution**: Organize all PDFs in year-specific directories only

### Wrong Tax Amount
**Problem**: Extracting levy request instead of actual extension
**Solution**: Use "TAX EXTENSION GRAND TOTAL" regex pattern

### Multi-jurisdiction Districts
**Problem**: D200 includes non-Oak Park communities
**Solution**: Prorate by Oak Park's share of total EAV

### Similar Colors
**Problem**: Chart lines indistinguishable (e.g., teal and green too close)
**Solution**: Use completely different color families (red, blue, gray, orange, purple, green)

## Scraper Best Practices

- Default to 2006-present (earliest year with data)
- Check if files exist before downloading
- Fail gracefully on missing years or API errors
- Don't replace existing files
- Report skipped years at end of run

## Data Quality Notes

- Years 1999-2005: No data available
- Years 2006-2023: Complete data (18 years)
- All amounts in dollars
- Tax rates as percentages
- High School 200 values are Oak Park's adjusted portion only

## Interactive Dashboard Design

### Technology Stack
- **Frontend**: React with Vite
- **Charts**: Plotly.js for interactive visualizations
- **Styling**: Tailwind CSS v3
- **Data**: Embedded JavaScript (no backend needed)

### File Structure
```
tax-dashboard/
├── index.html              # Page title and favicon
├── src/
│   ├── App.jsx            # Main dashboard component
│   ├── data.js            # Embedded tax data and constants
│   ├── index.css          # Tailwind imports
│   └── main.jsx           # React entry point
├── tailwind.config.js     # Tailwind configuration
└── package.json           # Dependencies
```

### Data Processing Rules

**Township Consolidation**: General Assistance and Mental Health District are rolled up into Oak Park Township
- Combine all three agencies by year before filtering
- Display as single "Oak Park Township" in all charts
- Exclude "General Assistance" and "Mental Health District" from agency selector

### Chart Types

**1. Line Chart** (default)
- Multi-select agencies with color-coded lines
- Year range sliders (2006-2023)
- Inflation adjustment toggle (converts to 2006 dollars)
- Grand Total mode: shows single line summing all selected agencies

**2. Stacked Bar Chart**
- Shows composition over time
- Same filters as line chart
- Grand Total mode: single bar per year showing total

**3. Growth Comparison**
- Bars show total growth from 2006-2023
- Sorted by growth percentage (lowest to highest)
- CPI inflation reference line
- Tooltips show both total growth and annual growth (CAGR)
- Inflation adjustment disabled for this chart type
- Grand Total mode: single bar with combined growth

**4. Yearly Breakdown** (pie chart)
- Single year selector (slider from 2006-2023, defaults to 2023)
- Title updates to show selected year
- Shows percentage composition for that year
- Grand Total disabled for pie charts

### UI Layout

**Header**
- Title: "Oak Park Tax Explorer" (centered)
- Subtitle: "Interactive analysis of tax levies (2006-2023)"
- Background: Blue (#2563eb)
- Favicon: 📊 chart emoji

**Left Sidebar (Filters)**
- Chart Type dropdown
- Year Range sliders (or single year for pie chart)
- Inflation adjustment checkbox (disabled for growth comparison)
- Grand Total checkbox (disabled for pie chart)
- Agency checkboxes with color indicators

**Main Content Area**
- Summary Stats (4 cards in 10-column grid):
  - Latest Year Total: 3 columns (30%)
  - Total Growth: 3 columns (30%)
  - Annual Growth: 2 columns (20%)
  - CPI Inflation: 2 columns (20%)
- Chart container (white background, shadow, padding)

### Color Scheme
```javascript
agencyColors = {
  "Oak Park Township": "#E74C3C",      // Red
  "Village of Oak Park": "#3498DB",    // Blue
  "Village Library Fund": "#7F8C8D",   // Gray
  "School District 97": "#F39C12",     // Orange
  "High School 200": "#9B59B6",        // Purple
  "Park District": "#27AE60",          // Green
  "General Assistance": "#E67E22",     // Dark Orange (rolled up)
  "Mental Health District": "#16A085"  // Teal (rolled up)
}
```

### Key Features
- **Responsive**: Works on desktop and mobile
- **Interactive**: Plotly zoom, pan, hover tooltips
- **Fast**: All data embedded, no API calls
- **Stateless**: All filters in React state, no persistence needed
- **Self-contained**: Single HTML file build output

### Development Commands
```bash
npm install              # Install dependencies
npm run dev             # Start dev server (http://localhost:5173)
npm run build           # Build for production (dist/ folder)
```

### Deployment
Build creates static files that can be hosted anywhere:
- GitHub Pages
- Netlify
- Vercel
- Any static file server

No backend or database required.
