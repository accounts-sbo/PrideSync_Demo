const express = require('express');
const router = express.Router();
const database = require('../models/database');
const logger = require('../services/logger');

/**
 * Get all Pride boats and KPN trackers for mapping
 * GET /api/device-management/data
 */




/**
 * Auto-map boats to trackers based on asset codes
 * POST /api/device-management/auto-map
 */
router.post('/auto-map', async (req, res) => {
  try {
    const [prideBoats, kpnTrackers] = await Promise.all([
      database.getAllPrideBoats(),
      database.getAllKPNTrackers()
    ]);

    // Validatie
    if (prideBoats.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Geen Pride boten gevonden',
        message: 'Upload eerst je Pride CSV via de import pagina.'
      });
    }

    if (kpnTrackers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Geen KPN trackers gevonden',
        message: 'Upload eerst je KPN CSV via de import pagina.'
      });
    }

    let mappingsCreated = 0;
    let skippedTrackers = [];
    let errors = [];

    // Filter alleen P-nummers (P1, P2, P3, etc.) - negeer O en R nummers
    const pTrackers = kpnTrackers.filter(tracker =>
      tracker.asset_code &&
      tracker.asset_code.startsWith('P') &&
      /^P\d+$/.test(tracker.asset_code)
    );

    logger.info(`Auto-mapping: Found ${pTrackers.length} P-trackers out of ${kpnTrackers.length} total trackers`);

    for (const tracker of pTrackers) {
      try {
        const assetCode = tracker.asset_code;
        // Extract position number from asset code (P1 -> 1, P2 -> 2, etc.)
        const position = parseInt(assetCode.substring(1));

        // Find Pride boat with matching position (P1 -> boot positie 1)
        const targetBoat = prideBoats.find(boat => boat.parade_position === position);

        if (targetBoat) {
          // Check if boat is already mapped
          const existingMappings = await database.getActiveBoatTrackerMappings(targetBoat.id);
          if (existingMappings.length === 0) {
            // Deactivate any existing mappings for this boat
            await database.deactivateBoatTrackerMappings(targetBoat.id);

            // Create new mapping
            await database.createBoatTrackerMapping({
              pride_boat_id: targetBoat.id,
              kpn_tracker_id: tracker.id,
              notes: `Auto-mapped: ${assetCode} -> ${targetBoat.name} (positie ${position})`,
              is_active: true
            });

            mappingsCreated++;
            logger.info(`Mapped ${assetCode} to boat ${targetBoat.name} (position ${position})`);
          } else {
            skippedTrackers.push(`${assetCode} (boot al gekoppeld)`);
          }
        } else {
          skippedTrackers.push(`${assetCode} (geen boot gevonden op positie ${position})`);
        }
      } catch (error) {
        errors.push(`${tracker.asset_code}: ${error.message}`);
        logger.error(`Error mapping ${tracker.asset_code}:`, error);
      }
    }

    // Bouw feedback bericht
    let message = `✅ ${mappingsCreated} automatische koppelingen gemaakt van ${pTrackers.length} P-trackers`;
    if (skippedTrackers.length > 0) {
      message += `\n⚠️ ${skippedTrackers.length} overgeslagen: ${skippedTrackers.join(', ')}`;
    }
    if (errors.length > 0) {
      message += `\n❌ ${errors.length} fouten opgetreden`;
    }

    res.json({
      success: true,
      message,
      data: {
        mappings_created: mappingsCreated,
        total_p_trackers: pTrackers.length,
        skipped: skippedTrackers.length,
        errors: errors.length,
        skipped_details: skippedTrackers,
        error_details: errors
      }
    });
  } catch (error) {
    logger.error('Error in auto-mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Auto-mapping failed',
      message: 'Fout bij automatische koppeling: ' + error.message
    });
  }
});

/**
 * Get Pride boats list with mapping status
 * GET /api/device-management/pride-boats-list
 */
router.get('/pride-boats-list', async (req, res) => {
  try {
    const prideBoats = await database.getAllPrideBoats();
    const activeMappings = await database.getAllActiveBoatTrackerMappings();

    const boatsWithStatus = prideBoats.map(boat => ({
      ...boat,
      is_mapped: activeMappings.some(mapping => mapping.pride_boat_id === boat.id)
    }));

    res.json(boatsWithStatus);
  } catch (error) {
    logger.error('Error fetching pride boats list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pride boats list',
      message: error.message
    });
  }
});

/**
 * Get KPN trackers list with mapping status
 * GET /api/device-management/kpn-trackers-list
 */
router.get('/kpn-trackers-list', async (req, res) => {
  try {
    const kpnTrackers = await database.getAllKPNTrackers();
    const activeMappings = await database.getAllActiveBoatTrackerMappings();

    const trackersWithStatus = kpnTrackers.map(tracker => ({
      ...tracker,
      is_mapped: activeMappings.some(mapping => mapping.kpn_tracker_id === tracker.id)
    }));

    res.json(trackersWithStatus);
  } catch (error) {
    logger.error('Error fetching KPN trackers list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch KPN trackers list',
      message: error.message
    });
  }
});

/**
 * Get available boats for manual mapping
 * GET /api/device-management/available-boats
 */
router.get('/available-boats', async (req, res) => {
  try {
    const prideBoats = await database.getAllPrideBoats();
    const activeMappings = await database.getAllActiveBoatTrackerMappings();

    const availableBoats = prideBoats.filter(boat =>
      !activeMappings.some(mapping => mapping.pride_boat_id === boat.id)
    );

    res.json(availableBoats);
  } catch (error) {
    logger.error('Error fetching available boats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available boats',
      message: error.message
    });
  }
});

/**
 * Get available trackers for manual mapping
 * GET /api/device-management/available-trackers
 */
router.get('/available-trackers', async (req, res) => {
  try {
    const kpnTrackers = await database.getAllKPNTrackers();
    const activeMappings = await database.getAllActiveBoatTrackerMappings();

    const availableTrackers = kpnTrackers.filter(tracker =>
      !activeMappings.some(mapping => mapping.kpn_tracker_id === tracker.id)
    );

    res.json(availableTrackers);
  } catch (error) {
    logger.error('Error fetching available trackers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch available trackers',
      message: error.message
    });
  }
});

/**
 * Get current mappings with details
 * GET /api/device-management/mappings
 */
router.get('/mappings', async (req, res) => {
  try {
    const mappings = await database.getAllActiveBoatTrackerMappings();
    res.json(mappings);
  } catch (error) {
    logger.error('Error fetching mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mappings',
      message: error.message
    });
  }
});

/**
 * Manual mapping endpoint
 * POST /api/device-management/manual-map
 */
router.post('/manual-map', async (req, res) => {
  try {
    const { pride_boat_id, kpn_tracker_id, notes } = req.body;

    if (!pride_boat_id || !kpn_tracker_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'pride_boat_id and kpn_tracker_id are required'
      });
    }

    // Deactivate any existing mappings for this boat
    await database.deactivateBoatTrackerMappings(pride_boat_id);

    // Create new mapping
    const mapping = await database.createBoatTrackerMapping({
      pride_boat_id,
      kpn_tracker_id,
      notes: notes || null,
      is_active: true
    });

    res.json({
      success: true,
      message: 'Handmatige koppeling succesvol aangemaakt',
      data: mapping
    });
  } catch (error) {
    logger.error('Error creating manual mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create manual mapping',
      message: error.message
    });
  }
});

/**
 * Delete mapping endpoint
 * DELETE /api/device-management/mappings/:mappingId
 */
router.delete('/mappings/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;

    await database.deactivateBoatTrackerMapping(mappingId);

    res.json({
      success: true,
      message: 'Koppeling succesvol verwijderd'
    });
  } catch (error) {
    logger.error('Error removing mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove mapping',
      message: error.message
    });
  }
});

/**
 * Update stats endpoint to return proper format
 * GET /api/device-management/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const [prideBoats, kpnTrackers, activeMappings] = await Promise.all([
      database.getAllPrideBoats(),
      database.getAllKPNTrackers(),
      database.getAllActiveBoatTrackerMappings()
    ]);

    const stats = {
      prideBoats: prideBoats.length,
      kpnTrackers: kpnTrackers.length,
      unmappedBoats: prideBoats.length - activeMappings.length,
      mappedBoats: activeMappings.length
    };

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching mapping stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

/**
 * Serve modern device management interface
 */
router.get('/cms', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="nl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PrideSync Device Management</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gray-50">
    <div class="container mx-auto px-4 py-8" x-data="deviceManager()">
        <!-- Header -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">🏳️‍🌈 PrideSync Device Management</h1>
            <p class="text-gray-600">Beheer de koppeling tussen Pride boten en KPN GPS trackers</p>
        </div>

        <!-- Step-by-step workflow -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <!-- Step 1: Upload Files -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-center mb-4">
                    <div class="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm mr-3">1</div>
                    <h2 class="text-lg font-semibold text-gray-900">Upload CSV Bestanden</h2>
                </div>
                <div class="space-y-3">
                    <div class="border border-gray-200 rounded-lg p-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-700">Pride Boten CSV</span>
                            <span class="text-xs px-2 py-1 rounded-full"
                                  :class="stats.prideBoats > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                                  x-text="stats.prideBoats > 0 ? stats.prideBoats + ' boten' : 'Niet geüpload'"></span>
                        </div>
                        <a href="https://pride-sync-demo-frontend-2025.vercel.app/admin/import" target="_blank"
                           class="inline-block w-full text-center bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors">
                            📤 Upload Pride CSV
                        </a>
                    </div>
                    <div class="border border-gray-200 rounded-lg p-3">
                        <div class="flex items-center justify-between mb-2">
                            <span class="text-sm font-medium text-gray-700">KPN Trackers CSV</span>
                            <span class="text-xs px-2 py-1 rounded-full"
                                  :class="stats.kpnTrackers > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'"
                                  x-text="stats.kpnTrackers > 0 ? stats.kpnTrackers + ' trackers' : 'Niet geüpload'"></span>
                        </div>
                        <a href="https://pride-sync-demo-frontend-2025.vercel.app/admin/import" target="_blank"
                           class="inline-block w-full text-center bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors">
                            📤 Upload KPN CSV
                        </a>
                    </div>
                </div>
            </div>

            <!-- Step 2: Auto-mapping -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-center mb-4">
                    <div class="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm mr-3">2</div>
                    <h2 class="text-lg font-semibold text-gray-900">Automatische Koppeling</h2>
                </div>
                <div class="mb-4">
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3">
                        <p class="text-sm text-purple-800 mb-2"><strong>Hoe werkt het:</strong></p>
                        <ul class="text-xs text-purple-700 space-y-1">
                            <li>• P1 → Boot op positie 1</li>
                            <li>• P2 → Boot op positie 2</li>
                            <li>• P3 → Boot op positie 3</li>
                            <li>• <em>etc...</em></li>
                        </ul>
                        <p class="text-xs text-purple-600 mt-2 font-medium">O-nummers en R-nummers worden genegeerd</p>
                    </div>
                    <button @click="autoMap()"
                            :disabled="stats.prideBoats === 0 || stats.kpnTrackers === 0"
                            :class="stats.prideBoats === 0 || stats.kpnTrackers === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'"
                            class="w-full text-white px-4 py-2 rounded text-sm font-medium transition-colors">
                        🤖 Start Auto-Mapping
                    </button>
                </div>
            </div>

            <!-- Step 3: Review Results -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div class="flex items-center mb-4">
                    <div class="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm mr-3">3</div>
                    <h2 class="text-lg font-semibold text-gray-900">Resultaat</h2>
                </div>
                <div class="space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Gekoppelde boten:</span>
                        <span class="font-semibold text-green-600" x-text="stats.mappedBoats || 0"></span>
                    </div>
                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-600">Nog te koppelen:</span>
                        <span class="font-semibold text-orange-600" x-text="stats.unmappedBoats || 0"></span>
                    </div>
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-green-600 h-2 rounded-full transition-all duration-300"
                             :style="'width: ' + ((stats.mappedBoats / (stats.mappedBoats + stats.unmappedBoats)) * 100 || 0) + '%'"></div>
                    </div>
                    <p class="text-xs text-gray-500 text-center"
                       x-text="Math.round((stats.mappedBoats / (stats.mappedBoats + stats.unmappedBoats)) * 100 || 0) + '% voltooid'"></p>
                </div>
            </div>
        </div>

        <!-- Side-by-side Data Overview -->
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8" x-show="stats.prideBoats > 0 || stats.kpnTrackers > 0">
            <!-- Pride Boats Table -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                        🚢 Pride Boten Database
                        <span class="ml-2 text-sm font-normal text-gray-500">(<span x-text="prideBoats.length"></span> boten)</span>
                    </h3>
                </div>
                <div class="overflow-hidden">
                    <div class="max-h-96 overflow-y-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Positie</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Boot Naam</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <template x-for="boat in prideBoats" :key="boat.id">
                                    <tr :class="boat.is_mapped ? 'bg-green-50' : 'bg-white'">
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span class="text-sm font-medium text-gray-900" x-text="boat.parade_position || boat.nr"></span>
                                        </td>
                                        <td class="px-4 py-3">
                                            <div class="text-sm font-medium text-gray-900" x-text="boat.naam || boat.name"></div>
                                            <div class="text-xs text-gray-500" x-text="boat.organisatie_boot || boat.organization"></div>
                                        </td>
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span :class="boat.is_mapped ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                                                  class="px-2 py-1 text-xs font-medium rounded-full">
                                                <span x-text="boat.is_mapped ? '✓ Gekoppeld' : '○ Beschikbaar'"></span>
                                            </span>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- KPN Trackers Table -->
            <div class="bg-white rounded-lg shadow-sm border border-gray-200">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                        📡 KPN Trackers Database
                        <span class="ml-2 text-sm font-normal text-gray-500">(<span x-text="kpnTrackers.length"></span> trackers)</span>
                    </h3>
                </div>
                <div class="overflow-hidden">
                    <div class="max-h-96 overflow-y-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 sticky top-0">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Asset Code</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tracker Info</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <template x-for="tracker in kpnTrackers" :key="tracker.id">
                                    <tr :class="tracker.is_mapped ? 'bg-green-50' : (tracker.asset_code && tracker.asset_code.startsWith('P') ? 'bg-blue-50' : 'bg-gray-50')">
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span :class="tracker.asset_code && tracker.asset_code.startsWith('P') ? 'text-blue-600 font-semibold' : 'text-gray-400'"
                                                  class="text-sm" x-text="tracker.asset_code || 'Geen code'"></span>
                                        </td>
                                        <td class="px-4 py-3">
                                            <div class="text-sm font-medium text-gray-900" x-text="tracker.name || tracker.serial_number"></div>
                                            <div class="text-xs text-gray-500" x-text="tracker.device_type"></div>
                                        </td>
                                        <td class="px-4 py-3 whitespace-nowrap">
                                            <span x-show="tracker.is_mapped" class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                                                ✓ Gekoppeld
                                            </span>
                                            <span x-show="!tracker.is_mapped && tracker.asset_code && tracker.asset_code.startsWith('P')"
                                                  class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                                                P-tracker
                                            </span>
                                            <span x-show="!tracker.is_mapped && tracker.asset_code && !tracker.asset_code.startsWith('P')"
                                                  class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                                                Genegeerd
                                            </span>
                                        </td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Current Mappings with Visual Connections -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8" x-show="mappings.length > 0">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                    🔗 Actieve Koppelingen
                    <span class="ml-2 text-sm font-normal text-gray-500">(<span x-text="mappings.length"></span> koppelingen)</span>
                </h3>
            </div>
            <div class="p-6">
                <div class="space-y-3">
                    <template x-for="mapping in mappings" :key="mapping.id">
                        <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div class="flex items-center space-x-4">
                                <!-- Pride Boat -->
                                <div class="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg">
                                    <div class="text-sm font-semibold" x-text="'Boot ' + (mapping.pride_boat_parade_position || mapping.pride_boat_nr)"></div>
                                    <div class="text-xs" x-text="mapping.pride_boat_naam"></div>
                                </div>

                                <!-- Connection Arrow -->
                                <div class="flex items-center text-gray-400">
                                    <div class="w-8 h-px bg-gray-300"></div>
                                    <span class="mx-2">🔗</span>
                                    <div class="w-8 h-px bg-gray-300"></div>
                                </div>

                                <!-- KPN Tracker -->
                                <div class="bg-green-100 text-green-800 px-3 py-2 rounded-lg">
                                    <div class="text-sm font-semibold" x-text="mapping.kpn_tracker_asset_code"></div>
                                    <div class="text-xs" x-text="mapping.kpn_tracker_name"></div>
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center space-x-2">
                                <span x-show="mapping.notes" class="text-xs text-gray-500 bg-white px-2 py-1 rounded" x-text="mapping.notes"></span>
                                <button @click="removeMapping(mapping.id)"
                                        class="text-red-600 hover:text-red-800 text-sm font-medium">
                                    🗑️ Verwijder
                                </button>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <!-- Manual Mapping Section -->
        <div class="bg-white rounded-lg shadow-sm border border-gray-200" x-show="availableBoats.length > 0 && availableTrackers.length > 0">
            <div class="px-6 py-4 border-b border-gray-200">
                <h3 class="text-lg font-semibold text-gray-900">🔧 Handmatige Koppeling</h3>
                <p class="text-sm text-gray-600 mt-1">Koppel handmatig een Pride boot aan een KPN tracker</p>
            </div>
            <div class="p-6">
                <form @submit.prevent="createManualMapping()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Pride Boot</label>
                        <select x-model="newMapping.pride_boat_id" required class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="">Selecteer een boot...</option>
                            <template x-for="boat in availableBoats" :key="boat.id">
                                <option :value="boat.id" x-text="'Positie ' + (boat.parade_position || boat.nr) + ' - ' + (boat.naam || boat.name)"></option>
                            </template>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">KPN Tracker</label>
                        <select x-model="newMapping.kpn_tracker_id" required class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500">
                            <option value="">Selecteer een tracker...</option>
                            <template x-for="tracker in availableTrackers" :key="tracker.id">
                                <option :value="tracker.id" x-text="tracker.asset_code + ' - ' + (tracker.name || tracker.serial_number)"></option>
                            </template>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Notities (optioneel)</label>
                        <input type="text" x-model="newMapping.notes"
                               class="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                               placeholder="Optionele notities...">
                    </div>
                    <div class="flex items-end">
                        <button type="submit" class="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 font-medium transition-colors">
                            ➕ Koppeling Maken
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <script>
        function deviceManager() {
            return {
                // Data arrays
                prideBoats: [],
                kpnTrackers: [],
                mappings: [],
                availableBoats: [],
                availableTrackers: [],

                // Stats
                stats: {
                    prideBoats: 0,
                    kpnTrackers: 0,
                    mappedBoats: 0,
                    unmappedBoats: 0
                },

                // Form data
                newMapping: {
                    pride_boat_id: '',
                    kpn_tracker_id: '',
                    notes: ''
                },

                async init() {
                    await this.loadAllData();
                    // Refresh data every 30 seconds
                    setInterval(() => this.loadAllData(), 30000);
                },

                async loadAllData() {
                    try {
                        await Promise.all([
                            this.loadPrideBoats(),
                            this.loadKpnTrackers(),
                            this.loadMappings(),
                            this.loadAvailableBoats(),
                            this.loadAvailableTrackers(),
                            this.loadStats()
                        ]);
                    } catch (error) {
                        console.error('Error loading data:', error);
                    }
                },

                async loadPrideBoats() {
                    try {
                        const response = await fetch('/api/device-management/pride-boats-list');
                        this.prideBoats = await response.json();
                    } catch (error) {
                        console.error('Error loading pride boats:', error);
                        this.prideBoats = [];
                    }
                },

                async loadKpnTrackers() {
                    try {
                        const response = await fetch('/api/device-management/kpn-trackers-list');
                        this.kpnTrackers = await response.json();
                    } catch (error) {
                        console.error('Error loading KPN trackers:', error);
                        this.kpnTrackers = [];
                    }
                },

                async loadMappings() {
                    try {
                        const response = await fetch('/api/device-management/mappings');
                        this.mappings = await response.json();
                    } catch (error) {
                        console.error('Error loading mappings:', error);
                        this.mappings = [];
                    }
                },

                async loadAvailableBoats() {
                    try {
                        const response = await fetch('/api/device-management/available-boats');
                        this.availableBoats = await response.json();
                    } catch (error) {
                        console.error('Error loading available boats:', error);
                        this.availableBoats = [];
                    }
                },

                async loadAvailableTrackers() {
                    try {
                        const response = await fetch('/api/device-management/available-trackers');
                        this.availableTrackers = await response.json();
                    } catch (error) {
                        console.error('Error loading available trackers:', error);
                        this.availableTrackers = [];
                    }
                },

                async loadStats() {
                    try {
                        const response = await fetch('/api/device-management/stats');
                        this.stats = await response.json();
                    } catch (error) {
                        console.error('Error loading stats:', error);
                        this.stats = { prideBoats: 0, kpnTrackers: 0, mappedBoats: 0, unmappedBoats: 0 };
                    }
                },

                async autoMap() {
                    if (this.stats.prideBoats === 0 || this.stats.kpnTrackers === 0) {
                        alert('⚠️ Upload eerst beide CSV bestanden voordat je auto-mapping kunt starten.');
                        return;
                    }

                    try {
                        const response = await fetch('/api/device-management/auto-map', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        const result = await response.json();
                        if (result.success) {
                            let message = '🎉 Auto-mapping voltooid!\\n\\n';

                            if (result.data) {
                                const { mappings_created, total_p_trackers, skipped, errors, skipped_details } = result.data;

                                message += \`📊 Resultaat:\\n\`;
                                message += \`✅ \${mappings_created} van \${total_p_trackers} P-trackers gekoppeld\\n\`;

                                if (skipped > 0) {
                                    message += \`⚠️ \${skipped} overgeslagen\\n\`;
                                }

                                if (errors > 0) {
                                    message += \`❌ \${errors} fouten\\n\`;
                                }

                                message += \`\\n💡 Bekijk de tabellen hieronder voor het volledige overzicht.\`;
                            }

                            alert(message);
                            await this.loadAllData();
                        } else {
                            alert('❌ Fout tijdens auto-mapping: ' + (result.message || result.error));
                        }
                    } catch (error) {
                        console.error('Error in auto-mapping:', error);
                        alert('❌ Fout tijdens auto-mapping: ' + error.message);
                    }
                },

                async createManualMapping() {
                    if (!this.newMapping.pride_boat_id || !this.newMapping.kpn_tracker_id) {
                        alert('⚠️ Selecteer zowel een Pride boot als een KPN tracker.');
                        return;
                    }

                    try {
                        const response = await fetch('/api/device-management/manual-map', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(this.newMapping)
                        });

                        const result = await response.json();
                        if (result.success) {
                            this.newMapping = { pride_boat_id: '', kpn_tracker_id: '', notes: '' };
                            await this.loadAllData();
                            alert('✅ Handmatige koppeling succesvol aangemaakt!');
                        } else {
                            alert('❌ Fout: ' + (result.error || result.message));
                        }
                    } catch (error) {
                        console.error('Error creating manual mapping:', error);
                        alert('❌ Fout bij het maken van de koppeling: ' + error.message);
                    }
                },

                async removeMapping(mappingId) {
                    if (!confirm('🗑️ Weet je zeker dat je deze koppeling wilt verwijderen?')) return;

                    try {
                        const response = await fetch('/api/device-management/mappings/' + mappingId, {
                            method: 'DELETE'
                        });

                        const result = await response.json();
                        if (result.success) {
                            await this.loadAllData();
                            alert('✅ Koppeling succesvol verwijderd!');
                        } else {
                            alert('❌ Fout: ' + (result.error || result.message));
                        }
                    } catch (error) {
                        console.error('Error removing mapping:', error);
                        alert('❌ Fout bij het verwijderen van de koppeling: ' + error.message);
                    }
                }
            }
        }
    </script>
</body>
</html>
  `);
});

module.exports = router;
