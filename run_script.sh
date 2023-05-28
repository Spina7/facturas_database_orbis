#!/bin/bash

# Run the Node.js script
node facturas.js

# Commit changes
git pull
git add .
git commit -m "Update data"

# Push to GitHub
git push origin main
