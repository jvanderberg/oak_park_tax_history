#!/bin/bash
# Setup virtual environment and run the complete tax data analysis pipeline

set -e  # Exit on any error

echo "======================================================================"
echo "Oak Park Tax Data Analysis - Setup and Run"
echo "======================================================================"

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "Error: python3 is required but not found"
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo ""
    echo "Virtual environment already exists"
fi

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"

# Install/upgrade dependencies
echo ""
echo "Installing dependencies from requirements.txt..."
pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "✓ Dependencies installed"

# Run the complete pipeline
echo ""
echo "======================================================================"
echo "Running complete analysis pipeline..."
echo "======================================================================"
python3 generate_all.py

# Deactivate virtual environment


echo ""
echo "======================================================================"
echo "Setup and analysis complete!"
echo "======================================================================"
echo ""
echo "Generated files:"
echo "  - tax_data.csv"
echo "  - oak_park_levy_by_year.png"
echo "  - oak_park_total_increase_real_inflation.png"
echo "  - oak_park_levy_breakdown.png"
echo "  - oak_park_levy_stacked.png"
echo ""
echo "To re-run analysis in the future, you can either:"
echo "  1. Run this script again: ./setup_and_run.sh"
echo "  2. Or manually activate venv and run: source venv/bin/activate && python3 generate_all.py"
echo ""
