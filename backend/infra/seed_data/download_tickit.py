#!/usr/bin/env python3
"""
Download Redshift Tickit sample dataset and prepare for S3 deployment.

The Tickit data is available from the public AWS Redshift sample data bucket.
Run this script once to populate backend/infra/seed_data/tickit2/ before cdk deploy.

Usage:
    python download_tickit.py
"""
import os
import urllib.parse
import urllib.request
import zipfile
import shutil
import csv
import random

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "tickit2")

# Public Redshift sample data URLs (pipe-delimited text files)
BASE_URL = "https://s3.amazonaws.com/redshift-downloads/tickit"

TABLES = {
    "users": "allusers_pipe.txt",
    "venue": "venue_pipe.txt",
    "category": "category_pipe.txt",
    "date": "date2008_pipe.txt",
    "event": "allevents_pipe.txt",
    "listing": "listings_pipe.txt",
    "sales": "sales_tab.txt",  # tab-delimited, needs conversion
}


def download_file(url, dest):
    # Only permit HTTPS downloads. This blocks file:// and other custom schemes
    # that urllib would otherwise accept (Bandit B310).
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https":
        raise ValueError(f"Refusing to download from non-HTTPS URL: {url}")
    print(f"  Downloading {url} ...")
    urllib.request.urlretrieve(url, dest)  # nosec B310 - scheme validated to be https above


def convert_tab_to_pipe(src, dest):
    """Convert tab-delimited file to pipe-delimited."""
    with open(src, "r") as fin, open(dest, "w") as fout:
        for line in fin:
            fout.write(line.replace("\t", "|"))


def generate_sales_extended(sales_file, output_file):
    """
    Generate sales_extended by appending a 'team' column to sales data.
    Randomly assigns 'Team A' or 'Team B' to each row.
    """
    print("  Generating sales_extended with team column ...")
    random.seed(42)  # reproducible
    with open(sales_file, "r") as fin, open(output_file, "w") as fout:
        for line in fin:
            line = line.strip()
            if line:
                team = random.choice(["Team A", "Team B"])
                fout.write(f"{line}|{team}\n")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for table_name, filename in TABLES.items():
        table_dir = os.path.join(OUTPUT_DIR, table_name)
        os.makedirs(table_dir, exist_ok=True)

        url = f"{BASE_URL}/{filename}"
        raw_file = os.path.join(table_dir, f"{filename}")
        final_file = os.path.join(table_dir, "data.txt")

        download_file(url, raw_file)

        if table_name == "sales":
            # Sales is tab-delimited — convert to pipe
            convert_tab_to_pipe(raw_file, final_file)
            os.remove(raw_file)
        else:
            os.rename(raw_file, final_file)

    # Generate sales_extended from sales
    sales_file = os.path.join(OUTPUT_DIR, "sales", "data.txt")
    sales_ext_dir = os.path.join(OUTPUT_DIR, "sales_extended")
    os.makedirs(sales_ext_dir, exist_ok=True)
    generate_sales_extended(sales_file, os.path.join(sales_ext_dir, "data.txt"))

    print(f"\nDone! Seed data written to {OUTPUT_DIR}/")
    print("You can now run: cdk deploy FgacDataLakeStack")


if __name__ == "__main__":
    main()
