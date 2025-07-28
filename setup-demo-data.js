#!/usr/bin/env node

/**
 * Setup demo data for PrideSync
 * This script adds demo boats and simulates some GPS data
 */

const API_URL = 'https://pridesyncdemo-production.up.railway.app';

// Demo boats data
const demoBoten = [
  {
    boat_number: 1,
    name: "Pride Amsterdam",
    imei: "123456789012345",
    description: "Hoofdboot van Amsterdam Pride",
    captain_name: "Jan de Vries",
    captain_phone: "+31612345678",
    status: "waiting"
  },
  {
    boat_number: 2,
    name: "Rainbow Warriors",
    imei: "123456789012346",
    description: "LGBTQ+ activisten boot",
    captain_name: "Maria Jansen",
    captain_phone: "+31612345679",
    status: "waiting"
  },
  {
    boat_number: 3,
    name: "Love Wins",
    imei: "123456789012347",
    description: "Liefde overwint alles",
    captain_name: "Alex Chen",
    captain_phone: "+31612345680",
    status: "waiting"
  },
  {
    boat_number: 11,
    name: "Unity Float",
    imei: "123456789012348",
    description: "Eenheid en diversiteit",
    captain_name: "Sam Taylor",
    captain_phone: "+31612345681",
    status: "active"
  },
  {
    boat_number: 25,
    name: "Celebration",
    imei: "123456789012349",
    description: "Feest en vreugde",
    captain_name: "Robin van der Berg",
    captain_phone: "+31612345682",
    status: "active"
  }
];

// Demo GPS positions (Amsterdam Pride route)
const demoGPSData = [
  {
    bootnummer: 11,
    timestamp: new Date().toISOString(),
    latitude: 52.3851, // Start: Westerdok
    longitude: 4.8947
  },
  {
    bootnummer: 25,
    timestamp: new Date().toISOString(),
    latitude: 52.3789, // Midden route: Prinsengracht
    longitude: 4.8836
  }
];

async function addDemoBoat(boat) {
  try {
    const response = await fetch(`${API_URL}/api/cms/boats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(boat)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Added boat ${boat.boat_number}: ${boat.name}`);
      return result;
    } else {
      const error = await response.text();
      console.log(`❌ Failed to add boat ${boat.boat_number}: ${error}`);
    }
  } catch (error) {
    console.log(`❌ Error adding boat ${boat.boat_number}:`, error.message);
  }
}

async function sendGPSData(gpsData) {
  try {
    const response = await fetch(`${API_URL}/api/webhooks/kpn-gps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gpsData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`📍 GPS data sent for boat ${gpsData.bootnummer}`);
      return result;
    } else {
      const error = await response.text();
      console.log(`❌ Failed to send GPS data for boat ${gpsData.bootnummer}: ${error}`);
    }
  } catch (error) {
    console.log(`❌ Error sending GPS data for boat ${gpsData.bootnummer}:`, error.message);
  }
}

async function setupDemoData() {
  console.log('🚀 Setting up PrideSync demo data...\n');

  // Test API connection
  try {
    const healthResponse = await fetch(`${API_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ API connection successful:', healthData.status);
  } catch (error) {
    console.log('❌ Cannot connect to API:', error.message);
    return;
  }

  // Check if database is available
  try {
    const boatsResponse = await fetch(`${API_URL}/api/boats`);
    const boatsData = await boatsResponse.json();
    console.log('✅ Database connection working');
  } catch (error) {
    console.log('⚠️ Database may not be configured. Setting up Railway PostgreSQL...');
    console.log('\n📋 To fix this:');
    console.log('1. Go to your Railway dashboard');
    console.log('2. Click "New" → "Database" → "PostgreSQL"');
    console.log('3. Railway will automatically set DATABASE_URL');
    console.log('4. Redeploy your backend service');
    console.log('\n🔄 For now, the backend will use in-memory storage.');
  }

  console.log('\n📊 Adding demo boats...');
  for (const boat of demoBoten) {
    await addDemoBoat(boat);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }

  console.log('\n📍 Sending demo GPS data...');
  for (const gpsData of demoGPSData) {
    await sendGPSData(gpsData);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
  }

  console.log('\n🎉 Demo data setup complete!');
  console.log('\nYou can now:');
  console.log('1. Check the admin dashboard for boat status');
  console.log('2. View the parade status and statistics');
  console.log('3. Test the voting app with the active boats');
  console.log('\n🔗 Useful URLs:');
  console.log(`- Health check: ${API_URL}/health`);
  console.log(`- All boats: ${API_URL}/api/boats`);
  console.log(`- Parade status: ${API_URL}/api/parade/status`);
  console.log(`- CMS stats: ${API_URL}/api/cms/stats`);
}

// Run the setup
setupDemoData().catch(console.error);
