#!/bin/bash

# Get the current date
DATE=$(date '+%Y-%m-%d')

# Create a logs folder if it doesn't exist
mkdir -p logs

# Run the Node.js script and write the output into a log file with the current date
node facturas.js > "logs/$DATE"_facturas_log.txt

# Check if the Node.js script ran successfully
if [ $? -eq 0 ]; then
    echo "Node.js script ran successfully, the output is in logs/$DATE_facturas_log.txt"
else
    echo "Node.js script failed, check logs/$DATE_facturas_log.txt for details"
    exit 1
fi

# Commit changes
git add .
git commit -m "Update data: $DATE"

# Check if the commit was successful
if [ $? -eq 0 ]; then
    echo "Changes were committed successfully"
else
    echo "Git commit failed"
    exit 1
fi

# Push to GitHub
git push origin main

# Check if the push was successful
if [ $? -eq 0 ]; then
    echo "Changes were pushed to GitHub successfully"
else
    echo "Git push failed"
    exit 1
fi

