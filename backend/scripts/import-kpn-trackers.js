#!/usr/bin/env node

/**
 * Import KPN Boats from CSV
 * 
 * Expected CSV format:
 * Asset Type,Name,Description,Project,Department,Asset Code,Device Type,Serial Number,Enabled,Last Connected,Last Trip,Current Status,Odometer (km),Run Hours (hrs)
 * 
 * Usage:
 * node scripts/import-kpn-boats.js path/to/kpn-boats.csv
 */

const fs = require('fs');
const path = require('path');
const { initializeDatabase, createKPNTracker, getAllKPNTrackers } = require('../src/models/database');
const logger = require('../src/services/logger');

// Parse CSV line (simple parser - handles basic CSV)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// Parse date from KPN format (2025/07/25)
function parseKPNDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const [year, month, day] = dateStr.split('/');
    return new Date(year, month - 1, day).toISOString();
  } catch (error) {
    return null;
  }
}

// Parse decimal number
function parseDecimal(str) {
  if (!str || str.trim() === '') return null;
  
  try {
    return parseFloat(str.replace(',', '.'));
  } catch (error) {
    return null;
  }
}

// Convert KPN row to tracker object
function convertKPNRowToTracker(row, headers) {
  const data = {};

  // Map headers to data
  headers.forEach((header, index) => {
    data[header] = row[index] || '';
  });

  // Validate tracker name (this is what we get in webhooks)
  const trackerName = data['Name'];
  if (!trackerName || trackerName.trim() === '') {
    throw new Error(`Missing tracker name in Name field`);
  }

  // Validate asset code
  const assetCode = data['Asset Code'];
  if (!assetCode || assetCode.trim() === '') {
    throw new Error(`Missing asset code for tracker ${trackerName}`);
  }

  return {
    tracker_name: trackerName,
    asset_code: assetCode,
    asset_type: data['Asset Type'] || 'Boat',
    device_type: data['Device Type'],
    serial_number: data['Serial Number'],
    imei: data['Description'], // KPN puts IMEI in description field
    enabled: data['Enabled'] === 'Enabled',
    last_connected: parseKPNDate(data['Last Connected']),
    current_status: data['Current Status'],
    odometer_km: parseDecimal(data['Odometer (km)']),
    run_hours: parseDecimal(data['Run Hours (hrs)']),
    project: data['Project'],
    department: data['Department'],
    description: `KPN Tracker ${trackerName} (${assetCode})`
  };
}

async function importKPNTrackers(csvFilePath) {
  console.log('📡 Starting KPN Trackers import...\n');
  
  // Check if file exists
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ File not found: ${csvFilePath}`);
    process.exit(1);
  }
  
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');
    
    // Read CSV file
    const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }
    
    // Parse header
    const headers = parseCSVLine(lines[0]);
    console.log(`📋 CSV Headers: ${headers.join(', ')}`);
    
    // Validate required headers
    const requiredHeaders = ['Asset Type', 'Name', 'Asset Code', 'Device Type', 'Serial Number'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }
    
    console.log(`📊 Found ${lines.length - 1} trackers to import\n`);

    // Process each tracker
    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVLine(lines[i]);

        if (row.length !== headers.length) {
          console.log(`⚠️ Row ${i}: Column count mismatch, skipping`);
          skipped++;
          continue;
        }

        const trackerData = convertKPNRowToTracker(row, headers);

        // Try to create tracker
        await createKPNTracker(trackerData);
        console.log(`✅ Imported tracker ${trackerData.tracker_name}: ${trackerData.asset_code}`);
        imported++;

      } catch (error) {
        console.log(`❌ Row ${i}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n🎉 KPN Trackers import completed!');
    console.log(`✅ Imported: ${imported} trackers`);
    console.log(`⚠️ Skipped: ${skipped} trackers`);
    console.log(`❌ Errors: ${errors} trackers`);

    // Show final stats
    const allTrackers = await getAllKPNTrackers();
    console.log(`\n📊 Total trackers in database: ${allTrackers.length}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.log('Usage: node scripts/import-kpn-trackers.js <csv-file-path>');
    console.log('\nExample:');
    console.log('  node scripts/import-kpn-trackers.js data/kpn-trackers.csv');
    console.log('\nExpected CSV format:');
    console.log('Asset Type,Name,Description,Project,Department,Asset Code,Device Type,Serial Number,Enabled,Last Connected,Last Trip,Current Status,Odometer (km),Run Hours (hrs)');
    console.log('\nNote: "Name" field is the tracker identifier used in webhooks');
    console.log('      "Asset Code" is the reference (P1, P2, O1, O2, R1, etc.)');
    process.exit(1);
  }

  importKPNTrackers(csvFilePath).catch(console.error);
}

module.exports = { importKPNTrackers };
