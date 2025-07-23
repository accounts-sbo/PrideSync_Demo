// Test script for KPN GPS webhook
const fetch = require('node-fetch');

const API_URL = 'http://localhost:3000';

async function testWebhook() {
  console.log('🧪 Testing KPN GPS Webhook...\n');

  // Test payload - boat 11 at Amsterdam coordinates
  const testPayload = {
    bootnummer: 11,
    timestamp: new Date().toISOString(),
    latitude: 52.37338,
    longitude: 4.89075
  };

  try {
    console.log('📤 Sending GPS update:', JSON.stringify(testPayload, null, 2));
    
    const response = await fetch(`${API_URL}/api/webhooks/kpn-gps`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const result = await response.json();
    
    console.log(`\n📥 Response (${response.status}):`, JSON.stringify(result, null, 2));

    if (response.ok) {
      console.log('\n✅ Webhook test successful!');
      
      // Test getting boat data
      console.log('\n🔍 Testing boat data retrieval...');
      const boatResponse = await fetch(`${API_URL}/api/boats/11`);
      const boatData = await boatResponse.json();
      console.log('📊 Boat data:', JSON.stringify(boatData, null, 2));
      
    } else {
      console.log('\n❌ Webhook test failed!');
    }

  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
  }
}

async function testAllEndpoints() {
  console.log('🚀 Testing all API endpoints...\n');

  const endpoints = [
    { name: 'Health Check', url: '/health' },
    { name: 'All Boats', url: '/api/boats' },
    { name: 'Parade Status', url: '/api/parade/status' },
    { name: 'Parade Route', url: '/api/parade/route' },
    { name: 'Parade Summary', url: '/api/parade/summary' }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`📡 Testing ${endpoint.name}...`);
      const response = await fetch(`${API_URL}${endpoint.url}`);
      const data = await response.json();
      
      console.log(`✅ ${endpoint.name} (${response.status}):`, 
        JSON.stringify(data, null, 2).substring(0, 200) + '...\n');
        
    } catch (error) {
      console.log(`❌ ${endpoint.name} failed:`, error.message, '\n');
    }
  }
}

// Run tests
async function runTests() {
  await testWebhook();
  console.log('\n' + '='.repeat(50) + '\n');
  await testAllEndpoints();
}

runTests();
