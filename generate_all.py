#!/usr/bin/env python3
"""
Master script to run entire tax data analysis pipeline:
1. Download PDFs from Cook County API
2. Extract data to CSV
3. Generate all charts
"""
import subprocess
import sys
from pathlib import Path

def run_script(script_name, description):
    """Run a Python script and report results"""
    print("\n" + "="*70)
    print(f"{description}")
    print("="*70)

    try:
        result = subprocess.run(
            [sys.executable, script_name],
            check=True,
            capture_output=True,
            text=True
        )
        print(result.stdout)
        if result.stderr:
            print("Warnings:", result.stderr)
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ {description} failed!")
        print("STDOUT:", e.stdout)
        print("STDERR:", e.stderr)
        return False
    except Exception as e:
        print(f"✗ Error running {script_name}: {e}")
        return False

def main():
    print("="*70)
    print("Oak Park Tax Data Analysis Pipeline")
    print("="*70)

    scripts = [
        ("scrape_tax_pdfs.py", "Step 1: Downloading PDFs from Cook County API"),
        ("extract_tax_data.py", "Step 2: Extracting data from PDFs to CSV"),
        ("chart_levy_history.py", "Step 3: Generating levy history chart"),
        ("chart_growth_comparison.py", "Step 4: Generating growth comparison chart"),
        ("chart_levy_breakdown.py", "Step 5: Generating levy breakdown chart"),
        ("chart_levy_stacked.py", "Step 6: Generating stacked levy chart"),
    ]

    results = []
    for script, description in scripts:
        if not Path(script).exists():
            print(f"\n✗ Script not found: {script}")
            results.append(False)
            continue

        success = run_script(script, description)
        results.append(success)

        if not success:
            print(f"\n⚠ Pipeline stopped due to error in: {description}")
            print("Fix the error and run again, or run remaining scripts manually.")
            sys.exit(1)

    # Summary
    print("\n" + "="*70)
    print("Pipeline Complete!")
    print("="*70)
    print("\nGenerated files:")
    print("  - tax_data.csv")
    print("  - oak_park_levy_by_year.png")
    print("  - oak_park_total_increase_real_inflation.png")
    print("  - oak_park_levy_breakdown.png")
    print("  - oak_park_levy_stacked.png")
    print("\nAll steps completed successfully!")

if __name__ == "__main__":
    main()
