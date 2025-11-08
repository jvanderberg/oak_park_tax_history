import { useState, useMemo, useEffect } from 'react';
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

  // Load state from localStorage with defaults
  const loadState = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        // Special handling for Set objects
        if (key === 'selectedAgencies' && Array.isArray(parsed)) {
          return new Set(parsed);
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error loading state:', e);
    }
    return defaultValue;
  };

  // State for filters with localStorage persistence
  const [selectedAgencies, setSelectedAgencies] = useState(() => loadState('selectedAgencies', allAgencies));
  const [yearRange, setYearRange] = useState(() => loadState('yearRange', [2006, 2023]));
  const [inflationAdjusted, setInflationAdjusted] = useState(() => loadState('inflationAdjusted', false));
  const [chartType, setChartType] = useState(() => loadState('chartType', 'line'));
  const [showGrandTotal, setShowGrandTotal] = useState(() => loadState('showGrandTotal', false));
  const [pieYear, setPieYear] = useState(() => loadState('pieYear', 2023));
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('selectedAgencies', JSON.stringify([...selectedAgencies]));
  }, [selectedAgencies]);

  useEffect(() => {
    localStorage.setItem('yearRange', JSON.stringify(yearRange));
  }, [yearRange]);

  useEffect(() => {
    localStorage.setItem('inflationAdjusted', JSON.stringify(inflationAdjusted));
  }, [inflationAdjusted]);

  useEffect(() => {
    localStorage.setItem('chartType', JSON.stringify(chartType));
  }, [chartType]);

  useEffect(() => {
    localStorage.setItem('showGrandTotal', JSON.stringify(showGrandTotal));
  }, [showGrandTotal]);

  useEffect(() => {
    localStorage.setItem('pieYear', JSON.stringify(pieYear));
  }, [pieYear]);

  // Turn off inflation adjustment when switching to growth comparison
  useEffect(() => {
    if (chartType === 'bar' && inflationAdjusted) {
      setInflationAdjusted(false);
    }
  }, [chartType]);

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
        const [startYear, endYear] = yearRange;
        let totalStart = 0;
        let totalEnd = 0;

        filteredData.forEach(d => {
          if (d.year === startYear) totalStart += d.adjustedAmount;
          if (d.year === endYear) totalEnd += d.adjustedAmount;
        });

        const growth = ((totalEnd - totalStart) / totalStart * 100);
        const yearDiff = endYear - startYear;
        const cagr = yearDiff > 0 ? (Math.pow(totalEnd / totalStart, 1 / yearDiff) - 1) * 100 : 0;
        const cpiStart = cumulativeInflation[startYear];
        const cpiEnd = cumulativeInflation[endYear];
        const cpiGrowth = ((cpiEnd / cpiStart) - 1) * 100;
        const cpiCAGR = yearDiff > 0 ? (Math.pow(cpiEnd / cpiStart, 1 / yearDiff) - 1) * 100 : 0;

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
        // Show growth between selected year range
        const [startYear, endYear] = yearRange;
        const agenciesStart = {};
        const agenciesEnd = {};

        filteredData.forEach(d => {
          if (d.year === startYear) agenciesStart[d.displayName] = d.adjustedAmount;
          if (d.year === endYear) agenciesEnd[d.displayName] = d.adjustedAmount;
        });

        // Create array of [agency, growth, cagr] and sort by growth
        const agencyGrowth = Object.keys(agenciesEnd).map(a => {
          const start = agenciesStart[a] || agenciesEnd[a];
          const end = agenciesEnd[a];
          const growth = ((end - start) / start * 100);
          const yearDiff = endYear - startYear;
          const cagr = yearDiff > 0 ? (Math.pow(end / start, 1 / yearDiff) - 1) * 100 : 0;
          return { agency: a, growth, cagr };
        }).sort((a, b) => a.growth - b.growth);

        const agencyList = agencyGrowth.map(d => d.agency);
        const growth = agencyGrowth.map(d => d.growth);
        const cagr = agencyGrowth.map(d => d.cagr);

        // Calculate CPI growth for the selected range
        const cpiStart = cumulativeInflation[startYear];
        const cpiEnd = cumulativeInflation[endYear];
        const cpiGrowth = ((cpiEnd / cpiStart) - 1) * 100;
        const yearDiff = endYear - startYear;
        const cpiCAGR = yearDiff > 0 ? (Math.pow(cpiEnd / cpiStart, 1 / yearDiff) - 1) * 100 : 0;

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
      // Show breakdown for selected year - need to get data independent of yearRange filter
      const rolledUpData = [];
      const townshipByYear = {};

      taxData.forEach(d => {
        const displayName = agencyDisplayNames[d.agencyName] || d.agencyName;

        // Roll up General Assistance and Mental Health into Township
        if (displayName === 'General Assistance' || displayName === 'Mental Health District') {
          if (!townshipByYear[d.year]) {
            townshipByYear[d.year] = {
              year: d.year,
              displayName: 'Oak Park Township',
              taxAmount: 0,
            };
          }
          townshipByYear[d.year].taxAmount += d.taxAmount;
        } else if (displayName === 'Oak Park Township') {
          if (!townshipByYear[d.year]) {
            townshipByYear[d.year] = {
              year: d.year,
              displayName: 'Oak Park Township',
              taxAmount: d.taxAmount,
            };
          } else {
            townshipByYear[d.year].taxAmount += d.taxAmount;
          }
        } else {
          rolledUpData.push({
            year: d.year,
            displayName,
            taxAmount: d.taxAmount
          });
        }
      });

      // Add rolled-up township data
      Object.values(townshipByYear).forEach(d => {
        rolledUpData.push(d);
      });

      // Filter only by selected agencies and pie year
      const dataForYear = rolledUpData.filter(d =>
        selectedAgencies.has(d.displayName) &&
        d.year === pieYear
      );

      return [{
        values: dataForYear.map(d => d.taxAmount),
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
  }, [filteredData, chartType, showGrandTotal, pieYear, selectedAgencies]);

  const layout = useMemo(() => {
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    const baseLayout = {
      font: { size: 14, family: 'Arial, sans-serif' },
      paper_bgcolor: 'white',
      plot_bgcolor: '#f8f9fa',
      margin: { t: 60, r: isMobile ? 20 : 80, b: isMobile ? 100 : 80, l: 80 },
      hovermode: 'closest'
    };

    if (chartType === 'line') {
      return {
        ...baseLayout,
        title: {
          text: `Oak Park Tax Levies by Agency (${yearRange[0]}-${yearRange[1]})${inflationAdjusted ? '<br><sub>Inflation-Adjusted to 2006 Dollars</sub>' : ''}`,
          font: { size: isMobile ? 16 : 24 }
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
        legend: isMobile ? {
          font: { size: 11 },
          orientation: 'h',
          x: 0,
          y: -0.2,
          xanchor: 'left',
          yanchor: 'top'
        } : {
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
          text: `Tax Levy Growth (${yearRange[0]}-${yearRange[1]}) vs Inflation`,
          font: { size: isMobile ? 18 : 24 }
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
          font: { size: isMobile ? 16 : 24 }
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
        legend: isMobile ? {
          font: { size: 11 },
          orientation: 'h',
          x: 0,
          y: -0.2,
          xanchor: 'left',
          yanchor: 'top'
        } : {
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
          font: { size: isMobile ? 18 : 24 }
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
      <header className="bg-blue-600 text-white py-4 md:py-6 shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center relative">
            <div className="text-center">
              <h1 className="text-2xl md:text-4xl font-bold">Oak Park Tax Explorer</h1>
              <p className="text-sm md:text-base text-blue-100 mt-1 md:mt-2">Interactive analysis of tax levies (2006-2023)</p>
            </div>
            <button
              onClick={() => setShowInfoModal(true)}
              className="absolute right-0 w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-400 transition-colors text-lg font-bold"
              aria-label="Information"
            >
              ?
            </button>
          </div>
        </div>
      </header>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowInfoModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 md:p-8">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">About This Dashboard</h2>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4 text-gray-700">
                <section>
                  <h3 className="font-bold text-lg mb-2">What is this?</h3>
                  <p>This tool shows how much Oak Park residents pay in property taxes to different local government agencies from 2006 to 2023. You can see how tax amounts have changed over time and compare them to inflation.</p>
                </section>

                <section>
                  <h3 className="font-bold text-lg mb-2">The Agencies</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li><strong>Oak Park Township</strong> - Provides senior services, general assistance, and mental health programs</li>
                    <li><strong>Village of Oak Park</strong> - Your municipal government (police, fire, roads, streets, etc.)</li>
                    <li><strong>Village Library Fund</strong> - Funds the Oak Park Public Library</li>
                    <li><strong>School District 97</strong> - Elementary schools</li>
                    <li><strong>High School 200</strong> - Oak Park & River Forest High School</li>
                    <li><strong>Park District</strong> - Parks, recreation programs, pools</li>
                  </ul>
                </section>

                <section>
                  <h3 className="font-bold text-lg mb-2">About High School 200</h3>
                  <p>High School 200 serves both Oak Park and River Forest. The numbers shown here are <strong>only Oak Park's portion</strong>, calculated based on Oak Park's share of the total property value in the district (typically 72-76%).</p>
                </section>

                <section>
                  <h3 className="font-bold text-lg mb-2">What is "Inflation Adjustment"?</h3>
                  <p>When you turn on inflation adjustment, the dollar amounts are converted to "2006 dollars." This helps you see if taxes truly increased or just kept pace with rising prices. For example, $100 in 2006 has the same buying power as about $151 in 2023.</p>
                </section>

                <section>
                  <h3 className="font-bold text-lg mb-2">Data Source</h3>
                  <p>All tax data comes from official reports published by the Cook County Clerk. Inflation rates are from the U.S. Bureau of Labor Statistics Consumer Price Index (CPI).</p>
                </section>

                <section>
                  <h3 className="font-bold text-lg mb-2">How to Use</h3>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Select which agencies to view using the checkboxes</li>
                    <li>Choose a chart type to visualize the data different ways</li>
                    <li>Adjust the year range to focus on specific time periods</li>
                    <li>Hover over charts to see exact numbers</li>
                  </ul>
                </section>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-2 md:px-4 py-4 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
          {/* Left Sidebar - Filters */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-4 md:p-6 lg:sticky lg:top-4">
              <h2 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-gray-800">Filters</h2>

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
                  <div className="relative pt-1 pb-6">
                    {/* Track background */}
                    <div className="absolute w-full h-2 bg-gray-200 rounded top-1"></div>
                    {/* Active range */}
                    <div
                      className="absolute h-2 bg-blue-500 rounded top-1"
                      style={{
                        left: `${((yearRange[0] - 2006) / 17) * 100}%`,
                        right: `${((2023 - yearRange[1]) / 17) * 100}%`
                      }}
                    ></div>
                    {/* Start year slider */}
                    <input
                      type="range"
                      min="2006"
                      max="2023"
                      value={yearRange[0]}
                      onChange={(e) => {
                        const newStart = parseInt(e.target.value);
                        if (newStart <= yearRange[1]) {
                          setYearRange([newStart, yearRange[1]]);
                        }
                      }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow"
                      style={{ top: '-2px' }}
                    />
                    {/* End year slider */}
                    <input
                      type="range"
                      min="2006"
                      max="2023"
                      value={yearRange[1]}
                      onChange={(e) => {
                        const newEnd = parseInt(e.target.value);
                        if (newEnd >= yearRange[0]) {
                          setYearRange([yearRange[0], newEnd]);
                        }
                      }}
                      className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow"
                      style={{ top: '-2px' }}
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
                <label className="flex items-center space-x-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={selectedAgencies.size === allAgencies.size}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAgencies(new Set(allAgencies));
                      } else {
                        setSelectedAgencies(new Set());
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-gray-700">
                    Select Agencies
                  </span>
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pl-6">
                  {agencies.map(agency => (
                    <label
                      key={agency.code}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgencies.has(agency.display)}
                        onChange={() => toggleAgency(agency.display)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 flex-1">
                        {agency.display}
                      </span>
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: agencyColors[agency.display] }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">
            {/* Summary Stats */}
            {summaryStats && (
              <div className="grid grid-cols-2 md:grid-cols-10 gap-2 md:gap-4">
                <div className="bg-white rounded-lg shadow-md p-3 md:p-4 col-span-2 md:col-span-3">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">Latest Year Total</div>
                  <div className="text-lg md:text-2xl font-bold text-gray-800">{summaryStats.lastYearTotal}</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-3 md:p-4 col-span-2 md:col-span-3">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">Total Growth</div>
                  <div className="text-lg md:text-2xl font-bold text-gray-800">{summaryStats.growth}%</div>
                  <div className="text-xs text-gray-500">{summaryStats.yearRange}</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-3 md:p-4 col-span-1 md:col-span-2">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">Annual Growth</div>
                  <div className="text-lg md:text-2xl font-bold text-gray-800">{summaryStats.cagr}%</div>
                  <div className="text-xs text-gray-500">vs CPI: 2.4%</div>
                </div>
                <div className="bg-white rounded-lg shadow-md p-3 md:p-4 col-span-1 md:col-span-2">
                  <div className="text-xs md:text-sm text-gray-600 mb-1">CPI Inflation</div>
                  <div className="text-lg md:text-2xl font-bold text-gray-800">50.8%</div>
                  <div className="text-xs text-gray-500">2006-2023</div>
                </div>
              </div>
            )}

            {/* Chart */}
            <div className="bg-white rounded-lg shadow-md p-3 md:p-6">
              {filteredData.length > 0 ? (
                <Plot
                  data={plotData}
                  layout={{
                    ...layout,
                    autosize: true,
                    dragmode: false,
                  }}
                  useResizeHandler={true}
                  className="chart-height"
                  style={{ width: '100%' }}
                  config={{
                    displayModeBar: false,
                    displaylogo: false,
                    staticPlot: false,
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
