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
const { initializeDatabase, createBoat, getAllBoats } = require('../src/models/database');
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

// Convert KPN row to boat object
function convertKPNRowToBoat(row, headers) {
  const data = {};
  
  // Map headers to data
  headers.forEach((header, index) => {
    data[header] = row[index] || '';
  });
  
  // Extract boat number from Name field (assuming it's the boat number)
  const boatNumber = parseInt(data['Name']);
  if (isNaN(boatNumber)) {
    throw new Error(`Invalid boat number in Name field: ${data['Name']}`);
  }
  
  return {
    boat_number: boatNumber,
    name: `Pride Boat ${boatNumber}`,
    description: data['Description'] || `KPN Tracked Boat ${boatNumber}`,
    status: 'waiting',
    
    // KPN specific fields
    asset_code: data['Asset Code'],
    asset_type: data['Asset Type'] || 'Boat',
    device_type: data['Device Type'],
    serial_number: data['Serial Number'],
    enabled: data['Enabled'] === 'Enabled',
    last_connected: parseKPNDate(data['Last Connected']),
    current_status: data['Current Status'],
    odometer_km: parseDecimal(data['Odometer (km)']),
    run_hours: parseDecimal(data['Run Hours (hrs)'])
  };
}

async function importKPNBoats(csvFilePath) {
  console.log('🚀 Starting KPN Boats import...\n');
  
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
    
    console.log(`📊 Found ${lines.length - 1} boats to import\n`);
    
    // Process each boat
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
        
        const boatData = convertKPNRowToBoat(row, headers);
        
        // Try to create boat
        await createBoat(boatData);
        console.log(`✅ Imported boat ${boatData.boat_number}: ${boatData.name}`);
        imported++;
        
      } catch (error) {
        console.log(`❌ Row ${i}: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n🎉 Import completed!');
    console.log(`✅ Imported: ${imported} boats`);
    console.log(`⚠️ Skipped: ${skipped} boats`);
    console.log(`❌ Errors: ${errors} boats`);
    
    // Show final stats
    const allBoats = await getAllBoats();
    console.log(`\n📊 Total boats in database: ${allBoats.length}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.log('Usage: node scripts/import-kpn-boats.js <csv-file-path>');
    console.log('\nExample:');
    console.log('  node scripts/import-kpn-boats.js data/kpn-boats.csv');
    console.log('\nExpected CSV format:');
    console.log('Asset Type,Name,Description,Project,Department,Asset Code,Device Type,Serial Number,Enabled,Last Connected,Last Trip,Current Status,Odometer (km),Run Hours (hrs)');
    process.exit(1);
  }
  
  importKPNBoats(csvFilePath).catch(console.error);
}

module.exports = { importKPNBoats };
