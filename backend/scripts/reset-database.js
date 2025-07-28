#!/usr/bin/env node

/**
 * Reset Database Script
 * 
 * This script drops all existing tables and recreates them with the new structure:
 * - pride_boats (Official Pride parade boats)
 * - kpn_trackers (KPN tracking devices)
 * - boat_tracker_mappings (Links boats to trackers)
 * 
 * Usage: node scripts/reset-database.js
 */

const { initializeDatabase, resetDatabase } = require('../src/models/database');
const logger = require('../src/services/logger');

async function main() {
  console.log('🗑️ Resetting PrideSync database...\n');
  
  try {
    // Initialize database connection
    await initializeDatabase();
    console.log('✅ Database connection established');
    
    // Reset database structure
    await resetDatabase();
    console.log('✅ Database reset complete');
    
    console.log('\n🎉 Database is ready for new data!');
    console.log('\nNext steps:');
    console.log('1. Import Pride boats: node scripts/import-pride-boats.js data/pride-boats.csv');
    console.log('2. Import KPN trackers: node scripts/import-kpn-trackers.js data/kpn-trackers.csv');
    console.log('3. Create mappings via admin interface');
    
  } catch (error) {
    console.error('❌ Database reset failed:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(console.error);
