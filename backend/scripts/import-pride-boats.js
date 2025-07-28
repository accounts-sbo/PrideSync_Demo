#!/usr/bin/env node

/**
 * Import Pride Boats from CSV
 * 
 * Expected CSV format for Pride organization boats:
 * Parade Position,Boat Name,Organisation,Theme,Description,Captain Name,Captain Phone,Captain Email,Boat Type,Length,Width,Max Persons,Notes
 * 
 * Usage:
 * node scripts/import-pride-boats.js path/to/pride-boats.csv
 */

const fs = require('fs');
const { initializeDatabase, createPrideBoat } = require('../src/models/database');
const logger = require('../src/services/logger');

// Parse CSV line (simple parser)
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

// Convert CSV row to Pride boat object
function convertRowToPrideBoat(row, headers) {
  const data = {};
  
  // Map headers to data
  headers.forEach((header, index) => {
    data[header] = row[index] || '';
  });
  
  // Extract parade position
  const paradePosition = parseInt(data['Parade Position'] || data['Position'] || data['Nummer']);
  if (isNaN(paradePosition)) {
    throw new Error(`Invalid parade position: ${data['Parade Position']}`);
  }
  
  return {
    parade_position: paradePosition,
    boat_name: data['Boat Name'] || data['Name'] || data['Naam'] || `Boot ${paradePosition}`,
    organisation: data['Organisation'] || data['Organisatie'] || null,
    theme: data['Theme'] || data['Thema'] || null,
    description: data['Description'] || data['Beschrijving'] || null,
    captain_name: data['Captain Name'] || data['Schipper'] || null,
    captain_phone: data['Captain Phone'] || data['Telefoon'] || null,
    captain_email: data['Captain Email'] || data['Email'] || null,
    boat_type: data['Boat Type'] || data['Boot Type'] || null,
    length_meters: parseFloat(data['Length'] || data['Lengte']) || null,
    width_meters: parseFloat(data['Width'] || data['Breedte']) || null,
    max_persons: parseInt(data['Max Persons'] || data['Max Personen']) || null,
    notes: data['Notes'] || data['Opmerkingen'] || null,
    status: 'registered'
  };
}

async function importPrideBoats(csvFilePath) {
  console.log('🏳️‍🌈 Starting Pride Boats import...\n');
  
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
        
        const boatData = convertRowToPrideBoat(row, headers);
        
        // Try to create boat
        await createPrideBoat(boatData);
        console.log(`✅ Imported boat ${boatData.parade_position}: ${boatData.boat_name}`);
        imported++;
        
      } catch (error) {
        console.log(`❌ Row ${i}: ${error.message}`);
        errors++;
      }
    }
    
    console.log('\n🎉 Pride Boats import completed!');
    console.log(`✅ Imported: ${imported} boats`);
    console.log(`⚠️ Skipped: ${skipped} boats`);
    console.log(`❌ Errors: ${errors} boats`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const csvFilePath = process.argv[2];
  
  if (!csvFilePath) {
    console.log('Usage: node scripts/import-pride-boats.js <csv-file-path>');
    console.log('\nExample:');
    console.log('  node scripts/import-pride-boats.js data/pride-boats.csv');
    console.log('\nExpected CSV format:');
    console.log('Parade Position,Boat Name,Organisation,Theme,Description,Captain Name,Captain Phone,Captain Email,Boat Type,Length,Width,Max Persons,Notes');
    process.exit(1);
  }
  
  importPrideBoats(csvFilePath).catch(console.error);
}

module.exports = { importPrideBoats };
