import { useState, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { taxData, inflationData, cumulativeInflation, agencyDisplayNames, agencyColors } from './data.js';

function App() {
  // Get unique agencies with display names (exclude rolled-up agencies)
  const allAgencies = useMemo(() => {
    const uniqueAgencies = [...new Set(taxData.map(d => d.agencyName))];
    return new Set(uniqueAgencies
      .map(name => agencyDisplayNames[name] || name)
      .filter(name => name !== 'General Assistance' && name !== 'Mental Health District'));
  }, []);

  // State for filters
  const [selectedAgencies, setSelectedAgencies] = useState(allAgencies);
  const [yearRange, setYearRange] = useState([2006, 2023]);
  const [inflationAdjusted, setInflationAdjusted] = useState(false);
  const [chartType, setChartType] = useState('line');
  const [showGrandTotal, setShowGrandTotal] = useState(false);
  const [pieYear, setPieYear] = useState(2023);

  // Get unique agencies with display names (exclude rolled-up agencies)
  const agencies = useMemo(() => {
    const uniqueAgencies = [...new Set(taxData.map(d => d.agencyName))];
    return uniqueAgencies
      .map(name => agencyDisplayNames[name] || name)
      .filter(name => name !== 'General Assistance' && name !== 'Mental Health District')
      .map((display, idx) => ({
        code: display,
        display: display
      }));
  }, []);

  // Filter and process data - roll up township agencies
  const filteredData = useMemo(() => {
    // First, roll up township agencies
    const rolledUpData = [];
    const townshipByYear = {};

    taxData.forEach(d => {
      const displayName = agencyDisplayNames[d.agencyName] || d.agencyName;

      // Roll up General Assistance and Mental Health into Township
      if (displayName === 'General Assistance' || displayName === 'Mental Health District') {
        if (!townshipByYear[d.year]) {
          townshipByYear[d.year] = {
            year: d.year,
            agencyName: 'TOWN OAK PARK',
            displayName: 'Oak Park Township',
            taxAmount: 0,
            eavTotal: d.eavTotal
          };
        }
        townshipByYear[d.year].taxAmount += d.taxAmount;
      } else if (displayName === 'Oak Park Township') {
        if (!townshipByYear[d.year]) {
          townshipByYear[d.year] = {
            year: d.year,
            agencyName: 'TOWN OAK PARK',
            displayName: 'Oak Park Township',
            taxAmount: d.taxAmount,
            eavTotal: d.eavTotal
          };
        } else {
          townshipByYear[d.year].taxAmount += d.taxAmount;
        }
      } else {
        rolledUpData.push({
          ...d,
          displayName
        });
      }
    });

    // Add rolled-up township data
    Object.values(townshipByYear).forEach(d => {
      rolledUpData.push(d);
    });

    // Now filter by selected agencies and year range
    return rolledUpData.filter(d =>
      selectedAgencies.has(d.displayName) &&
      d.year >= yearRange[0] &&
      d.year <= yearRange[1]
    ).map(d => ({
      ...d,
      adjustedAmount: inflationAdjusted
        ? d.taxAmount / cumulativeInflation[d.year]
        : d.taxAmount
    }));
  }, [selectedAgencies, yearRange, inflationAdjusted]);

  // Prepare data for Plotly
  const plotData = useMemo(() => {
    if (chartType === 'line') {
      if (showGrandTotal) {
        // Show single grand total line
        const totalByYear = {};
        filteredData.forEach(d => {
          if (!totalByYear[d.year]) {
            totalByYear[d.year] = 0;
          }
          totalByYear[d.year] += d.adjustedAmount;
        });

        const years = Object.keys(totalByYear).map(Number).sort();
        const amounts = years.map(y => totalByYear[y]);

        return [{
          x: years,
          y: amounts,
          type: 'scatter',
          mode: 'lines+markers',
          name: 'Grand Total',
          line: { color: '#2C3E50', width: 4 },
          marker: { size: 8 }
        }];
      } else {
        // Group by agency
        const byAgency = {};
        filteredData.forEach(d => {
          if (!byAgency[d.displayName]) {
            byAgency[d.displayName] = { years: [], amounts: [] };
          }
          byAgency[d.displayName].years.push(d.year);
          byAgency[d.displayName].amounts.push(d.adjustedAmount);
        });

        return Object.entries(byAgency).map(([agency, data]) => ({
          x: data.years,
          y: data.amounts,
          type: 'scatter',
          mode: 'lines+markers',
          name: agency,
          line: { color: agencyColors[agency], width: 3 },
          marker: { size: 6 }
        }));
      }
    } else if (chartType === 'bar') {
      if (showGrandTotal) {
        // Show single grand total bar for growth
        let total2006 = 0;
        let total2023 = 0;

        filteredData.forEach(d => {
          if (d.year === 2006) total2006 += d.adjustedAmount;
          if (d.year === 2023) total2023 += d.adjustedAmount;
        });

        const growth = ((total2023 - total2006) / total2006 * 100);
        const cagr = (Math.pow(total2023 / total2006, 1 / 17) - 1) * 100; // 17 years from 2006 to 2023
        const cpiGrowth = (cumulativeInflation[2023] - 1) * 100;
        const cpiCAGR = (Math.pow(cumulativeInflation[2023], 1 / 17) - 1) * 100;

        return [
          {
            x: ['Grand Total'],
            y: [growth],
            type: 'bar',
            marker: {
              color: '#2C3E50',
            },
            name: 'Tax Levy Growth',
            customdata: [cagr],
            hovertemplate: '<b>%{x}</b><br>Total Growth: %{y:.1f}%<br>Annual Growth: %{customdata:.2f}%<extra></extra>'
          },
          {
            x: ['Grand Total'],
            y: [cpiGrowth],
            type: 'scatter',
            mode: 'lines+markers',
            name: 'CPI Inflation',
            line: { color: 'red', width: 2, dash: 'dash' },
            marker: { size: 10, color: 'red' },
            hovertemplate: '<b>CPI</b><br>Total Growth: %{y:.1f}%<br>Annual Growth: ' + cpiCAGR.toFixed(2) + '%<extra></extra>'
          }
        ];
      } else {
        // Show 2023 vs 2006 growth
        const agencies2006 = {};
        const agencies2023 = {};

        filteredData.forEach(d => {
          if (d.year === 2006) agencies2006[d.displayName] = d.adjustedAmount;
          if (d.year === 2023) agencies2023[d.displayName] = d.adjustedAmount;
        });

        // Create array of [agency, growth, cagr] and sort by growth
        const agencyGrowth = Object.keys(agencies2023).map(a => {
          const start = agencies2006[a] || agencies2023[a];
          const end = agencies2023[a];
          const growth = ((end - start) / start * 100);
          const cagr = (Math.pow(end / start, 1 / 17) - 1) * 100;
          return { agency: a, growth, cagr };
        }).sort((a, b) => a.growth - b.growth);

        const agencyList = agencyGrowth.map(d => d.agency);
        const growth = agencyGrowth.map(d => d.growth);
        const cagr = agencyGrowth.map(d => d.cagr);

        // Calculate CPI growth
        const cpiGrowth = (cumulativeInflation[2023] - 1) * 100;
        const cpiCAGR = (Math.pow(cumulativeInflation[2023], 1 / 17) - 1) * 100;

        return [
          {
            x: agencyList,
            y: growth,
            type: 'bar',
            marker: {
              color: agencyList.map(a => agencyColors[a]),
            },
            name: 'Tax Levy Growth',
            customdata: cagr,
            hovertemplate: '<b>%{x}</b><br>Total Growth: %{y:.1f}%<br>Annual Growth: %{customdata:.2f}%<extra></extra>'
          },
          {
            x: agencyList,
            y: Array(agencyList.length).fill(cpiGrowth),
            type: 'scatter',
            mode: 'lines',
            name: 'CPI Inflation',
            line: { color: 'red', width: 2, dash: 'dash' },
            hovertemplate: '<b>CPI</b><br>Total Growth: %{y:.1f}%<br>Annual Growth: ' + cpiCAGR.toFixed(2) + '%<extra></extra>'
          }
        ];
      }
    } else if (chartType === 'stacked') {
      if (showGrandTotal) {
        // Show single bar per year with total
        const totalByYear = {};
        filteredData.forEach(d => {
          if (!totalByYear[d.year]) {
            totalByYear[d.year] = 0;
          }
          totalByYear[d.year] += d.adjustedAmount;
        });

        const years = Object.keys(totalByYear).map(Number).sort();
        const amounts = years.map(y => totalByYear[y]);

        return [{
          x: years,
          y: amounts,
          type: 'bar',
          name: 'Grand Total',
          marker: { color: '#2C3E50' },
          hovertemplate: '<b>Grand Total</b><br>%{x}: $%{y:,.0f}<extra></extra>'
        }];
      } else {
        // Stacked bar chart by year
        const byAgency = {};
        filteredData.forEach(d => {
          if (!byAgency[d.displayName]) {
            byAgency[d.displayName] = { years: [], amounts: [] };
          }
          byAgency[d.displayName].years.push(d.year);
          byAgency[d.displayName].amounts.push(d.adjustedAmount);
        });

        return Object.entries(byAgency).map(([agency, data]) => ({
          x: data.years,
          y: data.amounts,
          type: 'bar',
          name: agency,
          marker: { color: agencyColors[agency] },
          hovertemplate: '<b>%{fullData.name}</b><br>%{x}: $%{y:,.0f}<extra></extra>'
        }));
      }
    } else if (chartType === 'pie') {
      // Show breakdown for selected year
      const dataForYear = filteredData.filter(d => d.year === pieYear);

      return [{
        values: dataForYear.map(d => d.adjustedAmount),
        labels: dataForYear.map(d => d.displayName),
        type: 'pie',
        marker: {
          colors: dataForYear.map(d => agencyColors[d.displayName])
        },
        textinfo: 'label+percent',
        textposition: 'auto',
        hovertemplate: '<b>%{label}</b><br>$%{value:,.0f}<br>%{percent}<extra></extra>'
      }];
    }
  }, [filteredData, chartType, showGrandTotal, pieYear]);

  const layout = useMemo(() => {
    const baseLayout = {
      font: { size: 14, family: 'Arial, sans-serif' },
      paper_bgcolor: 'white',
      plot_bgcolor: '#f8f9fa',
      margin: { t: 60, r: 80, b: 80, l: 80 },
      hovermode: 'closest'
    };

    if (chartType === 'line') {
      return {
        ...baseLayout,
        title: {
          text: `Oak Park Tax Levies by Agency (${yearRange[0]}-${yearRange[1]})${inflationAdjusted ? '<br><sub>Inflation-Adjusted to 2006 Dollars</sub>' : ''}`,
          font: { size: 24 }
        },
        xaxis: {
          title: 'Year',
          titlefont: { size: 18 },
          tickfont: { size: 14 },
          gridcolor: '#e0e0e0'
        },
        yaxis: {
          title: inflationAdjusted ? 'Tax Amount (2006 Dollars)' : 'Tax Amount ($)',
          titlefont: { size: 18 },
          tickfont: { size: 14 },
          tickformat: '$,.0f',
          gridcolor: '#e0e0e0'
        },
        legend: {
          font: { size: 14 },
          orientation: 'v',
          x: 1.02,
          y: 1
        }
      };
    } else if (chartType === 'bar') {
      return {
        ...baseLayout,
        title: {
          text: 'Tax Levy Growth (2006-2023) vs Inflation',
          font: { size: 24 }
        },
        xaxis: {
          title: 'Agency',
          titlefont: { size: 18 },
          tickfont: { size: 12 },
          tickangle: -45
        },
        yaxis: {
          title: 'Growth (%)',
          titlefont: { size: 18 },
          tickfont: { size: 14 },
          tickformat: '.1f',
          gridcolor: '#e0e0e0'
        },
        legend: {
          font: { size: 14 }
        },
        showlegend: true
      };
    } else if (chartType === 'stacked') {
      return {
        ...baseLayout,
        title: {
          text: `Oak Park Tax Levies by Agency (${yearRange[0]}-${yearRange[1]})${inflationAdjusted ? '<br><sub>Inflation-Adjusted to 2006 Dollars</sub>' : ''}`,
          font: { size: 24 }
        },
        xaxis: {
          title: 'Year',
          titlefont: { size: 18 },
          tickfont: { size: 14 },
          gridcolor: '#e0e0e0'
        },
        yaxis: {
          title: inflationAdjusted ? 'Tax Amount (2006 Dollars)' : 'Tax Amount ($)',
          titlefont: { size: 18 },
          tickfont: { size: 14 },
          tickformat: '$,.0f',
          gridcolor: '#e0e0e0'
        },
        barmode: 'stack',
        legend: {
          font: { size: 14 },
          orientation: 'v',
          x: 1.02,
          y: 1
        }
      };
    } else if (chartType === 'pie') {
      return {
        ...baseLayout,
        title: {
          text: `${pieYear} Oak Park Tax Levy Breakdown`,
          font: { size: 24 }
        },
        showlegend: true,
        legend: {
          font: { size: 14 }
        }
      };
    }
  }, [chartType, yearRange, inflationAdjusted, pieYear]);

  const toggleAgency = (displayName) => {
    setSelectedAgencies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(displayName)) {
        newSet.delete(displayName);
      } else {
        newSet.add(displayName);
      }
      return newSet;
    });
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const total = filteredData.reduce((sum, d) => sum + d.adjustedAmount, 0);
    const years = [...new Set(filteredData.map(d => d.year))].sort();
    const firstYear = years[0];
    const lastYear = years[years.length - 1];

    const firstYearTotal = filteredData
      .filter(d => d.year === firstYear)
      .reduce((sum, d) => sum + d.adjustedAmount, 0);
    const lastYearTotal = filteredData
      .filter(d => d.year === lastYear)
      .reduce((sum, d) => sum + d.adjustedAmount, 0);

    const growth = ((lastYearTotal - firstYearTotal) / firstYearTotal * 100).toFixed(1);
    const cagr = (Math.pow(lastYearTotal / firstYearTotal, 1 / (lastYear - firstYear)) - 1) * 100;

    return {
      total: total.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
      lastYearTotal: lastYearTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }),
      growth: growth,
      cagr: cagr.toFixed(1),
      yearRange: `${firstYear}-${lastYear}`
    };
  }, [filteredData]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white py-6 shadow-lg">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold">Oak Park Tax Explorer</h1>
          <p className="text-blue-100 mt-2">Interactive analysis of tax levies (2006-2023)</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Filters */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-bold mb-4 text-gray-800">Filters</h2>

              {/* Chart Type */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chart Type
                </label>
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="line">Line Chart</option>
                  <option value="stacked">Stacked Bar Chart</option>
                  <option value="bar">Growth Comparison</option>
                  <option value="pie">Yearly Breakdown</option>
                </select>
              </div>

              {/* Year Range or Single Year Selector */}
              {chartType === 'pie' ? (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Year: {pieYear}
                  </label>
                  <input
                    type="range"
                    min="2006"
                    max="2023"
                    value={pieYear}
                    onChange={(e) => setPieYear(parseInt(e.target.value))}
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Year Range: {yearRange[0]} - {yearRange[1]}
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="2006"
                      max="2023"
                      value={yearRange[0]}
                      onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                      className="w-full"
                    />
                    <input
                      type="range"
                      min="2006"
                      max="2023"
                      value={yearRange[1]}
                      onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                      className="w-full"
                    />
                  </div>
                </div>
              )}

              {/* Inflation Toggle */}
              <div className="mb-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inflationAdjusted}
                    onChange={(e) => setInflationAdjusted(e.target.checked)}
                    disabled={chartType === 'bar'}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={`text-sm font-semibold ${chartType === 'bar' ? 'text-gray-400' : 'text-gray-700'}`}>
                    Adjust for Inflation
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Show values in 2006 dollars
                </p>
              </div>

              {/* Grand Total Toggle */}
              <div className="mb-6">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGrandTotal}
                    onChange={(e) => setShowGrandTotal(e.target.checked)}
                    disabled={chartType === 'pie'}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className={`text-sm font-semibold ${chartType === 'pie' ? 'text-gray-400' : 'text-gray-700'}`}>
                    Show Grand Total
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Display combined total of selected agencies
                </p>
              </div>

              {/* Agency Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Agencies
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {agencies.map(agency => (
                    <label
                      key={agency.code}
                      className="flex items-start space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgencies.has(agency.display)}
                        onChange={() => toggleAgency(agency.display)}
                        className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">
                        {agency.display}
                      </span>
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: agencyColors[agency.display] }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Summary Stats */}
            {summaryStats && (
              <div className="grid grid-cols-10 gap-4">
                <div className="bg-white rounded-lg shadow-md p-4 col-span-3">
                  <div className="text-sm text-gray-600 mb-1">Latest Year Total</div>
                  <div className="text-2xl font-bold text-gray-800">{summaryStats.lastYearTotal}</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 col-span-3">
                  <div className="text-sm text-gray-600 mb-1">Total Growth</div>
                  <div className="text-2xl font-bold text-gray-800">{summaryStats.growth}%</div>
                  <div className="text-xs text-gray-500">{summaryStats.yearRange}</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 col-span-2">
                  <div className="text-sm text-gray-600 mb-1">Annual Growth</div>
                  <div className="text-2xl font-bold text-gray-800">{summaryStats.cagr}%</div>
                  <div className="text-xs text-gray-500">vs CPI: 2.4%</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 col-span-2">
                  <div className="text-sm text-gray-600 mb-1">CPI Inflation</div>
                  <div className="text-2xl font-bold text-gray-800">50.8%</div>
                  <div className="text-xs text-gray-500">2006-2023</div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-lg shadow-md p-6">
              {filteredData.length > 0 ? (
                <Plot
                  data={plotData}
                  layout={{
                    ...layout,
                    autosize: true,
                  }}
                  useResizeHandler={true}
                  style={{ width: '100%', height: '600px' }}
                  config={{
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ['lasso2d', 'select2d']
                  }}
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No data to display</p>
                  <p className="text-sm mt-2">Please select at least one agency</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
