const express = require('express');
const router = express.Router();
const database = require('../models/database');
const logger = require('../services/logger');

/**
 * Get all Pride boats and KPN trackers for mapping
 * GET /api/device-management/data
 */
router.get('/data', async (req, res) => {
  try {
    const [prideBoats, kpnTrackers, mappings] = await Promise.all([
      database.getAllPrideBoats(),
      database.getAllKPNTrackers(),
      database.getAllBoatTrackerMappings()
    ]);

    res.json({
      success: true,
      data: {
        pride_boats: prideBoats,
        kpn_trackers: kpnTrackers,
        mappings: mappings
      }
    });
  } catch (error) {
    logger.error('Error fetching device management data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device management data',
      message: error.message
    });
  }
});

/**
 * Get mapping statistics
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
      total_pride_boats: prideBoats.length,
      total_kpn_trackers: kpnTrackers.length,
      active_mappings: activeMappings.length,
      unmapped_boats: prideBoats.length - activeMappings.length,
      unmapped_trackers: kpnTrackers.length - activeMappings.length,
      mapping_percentage: prideBoats.length > 0 ? Math.round((activeMappings.length / prideBoats.length) * 100) : 0
    };

    res.json({
      success: true,
      data: stats
    });
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
 * Create or update boat-tracker mapping
 * POST /api/device-management/mapping
 */
router.post('/mapping', async (req, res) => {
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
      message: 'Boat-tracker mapping created successfully',
      data: mapping
    });
  } catch (error) {
    logger.error('Error creating boat-tracker mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create mapping',
      message: error.message
    });
  }
});

/**
 * Remove boat-tracker mapping
 * DELETE /api/device-management/mapping/:mappingId
 */
router.delete('/mapping/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;

    await database.deactivateBoatTrackerMapping(mappingId);

    res.json({
      success: true,
      message: 'Boat-tracker mapping removed successfully'
    });
  } catch (error) {
    logger.error('Error removing boat-tracker mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove mapping',
      message: error.message
    });
  }
});

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
 * Serve modern device management interface
 */
router.get('/cms', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PrideSync Device Management</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js" defer></script>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto px-4 py-8" x-data="deviceManager()">
        <div class="bg-white rounded-lg shadow-lg p-6">
            <h1 class="text-3xl font-bold text-gray-800 mb-6">🏳️‍🌈 PrideSync Device Management</h1>

            <!-- Setup Instructions -->
            <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold text-blue-800 mb-4">📋 Setup Instructies</h2>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <div class="text-3xl mb-2">1️⃣</div>
                            <h3 class="font-semibold text-gray-800 mb-2">Upload Pride CSV</h3>
                            <p class="text-sm text-gray-600 mb-3">Upload je Pride boten CSV met boot nummers 0-16</p>
                            <a href="https://pride-sync-demo-frontend-2025.vercel.app/admin/import" target="_blank"
                               class="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                                📤 Ga naar Import
                            </a>
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <div class="text-3xl mb-2">2️⃣</div>
                            <h3 class="font-semibold text-gray-800 mb-2">Upload KPN CSV</h3>
                            <p class="text-sm text-gray-600 mb-3">Upload je KPN trackers CSV met P1-P16 asset codes</p>
                            <a href="https://pride-sync-demo-frontend-2025.vercel.app/admin/import" target="_blank"
                               class="inline-block bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                                📤 Ga naar Import
                            </a>
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="bg-white rounded-lg p-4 shadow-sm">
                            <div class="text-3xl mb-2">3️⃣</div>
                            <h3 class="font-semibold text-gray-800 mb-2">Auto-Koppeling</h3>
                            <p class="text-sm text-gray-600 mb-3">P1→Boot 1, P2→Boot 2, etc. automatisch koppelen</p>
                            <button @click="autoMap()"
                                    class="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                                🤖 Start Auto-Mapping
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Status Dashboard -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div class="text-2xl font-bold text-blue-600" x-text="stats.total_pride_boats || 0"></div>
                    <div class="text-sm text-gray-600">Pride Boten Geüpload</div>
                    <div class="text-xs text-gray-500 mt-1" x-show="stats.total_pride_boats === 0">Upload eerst je Pride CSV</div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div class="text-2xl font-bold text-green-600" x-text="stats.total_kpn_trackers || 0"></div>
                    <div class="text-sm text-gray-600">KPN Trackers Geüpload</div>
                    <div class="text-xs text-gray-500 mt-1" x-show="stats.total_kpn_trackers === 0">Upload eerst je KPN CSV</div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div class="text-2xl font-bold text-purple-600" x-text="stats.active_mappings || 0"></div>
                    <div class="text-sm text-gray-600">Actieve Koppelingen</div>
                    <div class="text-xs text-gray-500 mt-1" x-show="stats.active_mappings === 0">Nog geen koppelingen</div>
                </div>
                <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <div class="text-2xl font-bold text-indigo-600" x-text="(stats.mapping_percentage || 0) + '%'"></div>
                    <div class="text-sm text-gray-600">Voltooid</div>
                    <div class="text-xs text-gray-500 mt-1" x-show="stats.mapping_percentage === 0">Start met auto-mapping</div>
                </div>
            </div>

            <!-- Auto-mapping Section -->
            <div class="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold text-purple-800 mb-4">🤖 Automatische Koppeling</h2>
                <div class="bg-white rounded-lg p-4 mb-4 border border-purple-100">
                    <p class="text-gray-700 mb-3">
                        <strong>Hoe werkt het:</strong> De auto-mapping koppelt alleen P-nummers uit je KPN CSV aan Pride boten:
                    </p>
                    <ul class="text-sm text-gray-600 mb-3 space-y-1">
                        <li>• <strong>P1</strong> → Pride boot op positie <strong>1</strong></li>
                        <li>• <strong>P2</strong> → Pride boot op positie <strong>2</strong></li>
                        <li>• <strong>P3</strong> → Pride boot op positie <strong>3</strong></li>
                        <li>• <em>etc...</em></li>
                    </ul>
                    <div class="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        <strong>Let op:</strong> O-nummers en R-nummers worden genegeerd zoals je hebt gevraagd.
                    </div>
                </div>
                <button @click="autoMap()"
                        class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-2 rounded-md hover:from-purple-700 hover:to-indigo-700 font-medium">
                    🚀 Start Automatische Koppeling
                </button>
            </div>

            <!-- Data Overview Section -->
            <div class="bg-white border border-gray-200 rounded-lg p-6 mb-8" x-show="data.pride_boats.length > 0 || data.kpn_trackers.length > 0">
                <h2 class="text-xl font-semibold text-gray-800 mb-4">📊 Geüploade Data</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Pride Boats -->
                    <div class="bg-blue-50 rounded-lg p-4">
                        <h3 class="font-semibold text-blue-800 mb-3">Pride Boten (<span x-text="data.pride_boats.length"></span>)</h3>
                        <div class="max-h-32 overflow-y-auto">
                            <template x-for="boat in data.pride_boats.slice(0, 10)" :key="boat.id">
                                <div class="text-sm text-gray-600 py-1">
                                    <span class="font-medium" x-text="'Positie ' + boat.parade_position"></span>:
                                    <span x-text="boat.name"></span>
                                </div>
                            </template>
                            <div x-show="data.pride_boats.length > 10" class="text-xs text-gray-500 mt-2">
                                ... en <span x-text="data.pride_boats.length - 10"></span> meer
                            </div>
                        </div>
                    </div>

                    <!-- KPN Trackers -->
                    <div class="bg-green-50 rounded-lg p-4">
                        <h3 class="font-semibold text-green-800 mb-3">KPN Trackers (<span x-text="data.kpn_trackers.length"></span>)</h3>
                        <div class="max-h-32 overflow-y-auto">
                            <template x-for="tracker in data.kpn_trackers.filter(t => t.asset_code && t.asset_code.startsWith('P')).slice(0, 10)" :key="tracker.id">
                                <div class="text-sm text-gray-600 py-1">
                                    <span class="font-medium" x-text="tracker.asset_code"></span>:
                                    <span x-text="tracker.name || tracker.serial_number"></span>
                                </div>
                            </template>
                            <div x-show="data.kpn_trackers.filter(t => t.asset_code && t.asset_code.startsWith('P')).length > 10" class="text-xs text-gray-500 mt-2">
                                ... en meer P-trackers
                            </div>
                            <div x-show="data.kpn_trackers.filter(t => t.asset_code && (t.asset_code.startsWith('O') || t.asset_code.startsWith('R'))).length > 0" class="text-xs text-gray-400 mt-2">
                                + <span x-text="data.kpn_trackers.filter(t => t.asset_code && (t.asset_code.startsWith('O') || t.asset_code.startsWith('R'))).length"></span> O/R-trackers (worden genegeerd)
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Manual Mapping Section -->
            <div class="bg-gray-50 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">🔧 Handmatige Koppeling</h2>
                <form @submit.prevent="createMapping()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Pride Boat</label>
                        <select x-model="newMapping.pride_boat_id" required class="w-full p-2 border border-gray-300 rounded-md">
                            <option value="">Select Pride Boat</option>
                            <template x-for="boat in data.pride_boats" :key="boat.id">
                                <option :value="boat.id" x-text="'#' + boat.nr + ' - ' + boat.naam + ' (' + boat.organisatie_boot + ')'"></option>
                            </template>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">KPN Tracker</label>
                        <select x-model="newMapping.kpn_tracker_id" required class="w-full p-2 border border-gray-300 rounded-md">
                            <option value="">Select KPN Tracker</option>
                            <template x-for="tracker in data.kpn_trackers" :key="tracker.id">
                                <option :value="tracker.id" x-text="tracker.asset_code + ' - ' + tracker.name + ' (' + tracker.device_type + ')'"></option>
                            </template>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                        <input type="text" x-model="newMapping.notes"
                               class="w-full p-2 border border-gray-300 rounded-md"
                               placeholder="Optional notes...">
                    </div>
                    <div class="flex items-end">
                        <button type="submit" class="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700">
                            Create Mapping
                        </button>
                    </div>
                </form>
            </div>

            <!-- Current Mappings Table -->
            <div class="overflow-x-auto">
                <h2 class="text-xl font-semibold mb-4">Current Mappings</h2>
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pride Boat</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">KPN Tracker</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <template x-for="mapping in data.mappings" :key="mapping.id">
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900" x-text="'#' + mapping.pride_boat_nr + ' - ' + mapping.pride_boat_naam"></div>
                                    <div class="text-sm text-gray-500" x-text="mapping.pride_boat_organisatie"></div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900" x-text="mapping.kpn_tracker_asset_code + ' - ' + mapping.kpn_tracker_name"></div>
                                    <div class="text-sm text-gray-500" x-text="mapping.kpn_tracker_device_type"></div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="mapping.notes || 'No notes'"></td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span :class="mapping.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'"
                                          class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                        <span x-text="mapping.is_active ? 'Active' : 'Inactive'"></span>
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button @click="removeMapping(mapping.id)"
                                            class="text-red-600 hover:text-red-900">
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        function deviceManager() {
            return {
                data: {
                    pride_boats: [],
                    kpn_trackers: [],
                    mappings: []
                },
                stats: {
                    total_pride_boats: 0,
                    total_kpn_trackers: 0,
                    active_mappings: 0,
                    unmapped_boats: 0,
                    unmapped_trackers: 0,
                    mapping_percentage: 0
                },
                newMapping: {
                    pride_boat_id: '',
                    kpn_tracker_id: '',
                    notes: ''
                },

                async init() {
                    await this.loadData();
                    await this.loadStats();
                },

                async loadData() {
                    try {
                        const response = await fetch('/api/device-management/data');
                        const result = await response.json();
                        if (result.success) {
                            this.data = result.data;
                        }
                    } catch (error) {
                        console.error('Error loading data:', error);
                    }
                },

                async loadStats() {
                    try {
                        const response = await fetch('/api/device-management/stats');
                        const result = await response.json();
                        if (result.success) {
                            this.stats = result.data;
                        }
                    } catch (error) {
                        console.error('Error loading stats:', error);
                    }
                },

                async autoMap() {
                    try {
                        // Toon loading state
                        const loadingAlert = '🤖 Bezig met automatische koppeling van P-trackers...\n\nDit kan even duren.';

                        const response = await fetch('/api/device-management/auto-map', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        const result = await response.json();
                        if (result.success) {
                            // Bouw gedetailleerd resultaat bericht
                            let message = result.message;

                            if (result.data) {
                                const { mappings_created, total_p_trackers, skipped, errors, skipped_details } = result.data;

                                message += `\n\n📊 Gedetailleerd resultaat:`;
                                message += `\n✅ ${mappings_created} van ${total_p_trackers} P-trackers succesvol gekoppeld`;

                                if (skipped > 0) {
                                    message += `\n⚠️ ${skipped} overgeslagen:`;
                                    skipped_details.slice(0, 5).forEach(detail => {
                                        message += `\n   • ${detail}`;
                                    });
                                    if (skipped_details.length > 5) {
                                        message += `\n   • ... en ${skipped_details.length - 5} meer`;
                                    }
                                }

                                if (errors > 0) {
                                    message += `\n❌ ${errors} fouten opgetreden`;
                                }

                                message += `\n\n💡 Tip: Ga naar de import pagina om CSV bestanden te uploaden als je nog geen data hebt.`;
                            }

                            alert(message);
                            await this.loadData();
                            await this.loadStats();
                        } else {
                            alert('❌ Fout: ' + (result.message || result.error));
                        }
                    } catch (error) {
                        console.error('Error in auto-mapping:', error);
                        alert('❌ Fout tijdens auto-mapping: ' + error.message);
                    }
                },

                async createMapping() {
                    try {
                        const response = await fetch('/api/device-management/mapping', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(this.newMapping)
                        });

                        const result = await response.json();
                        if (result.success) {
                            this.newMapping = { pride_boat_id: '', kpn_tracker_id: '', notes: '' };
                            await this.loadData();
                            await this.loadStats();
                            alert('Mapping created successfully!');
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (error) {
                        console.error('Error creating mapping:', error);
                        alert('Error creating mapping');
                    }
                },

                async removeMapping(mappingId) {
                    if (!confirm('Are you sure you want to remove this mapping?')) return;

                    try {
                        const response = await fetch('/api/device-management/mapping/' + mappingId, {
                            method: 'DELETE'
                        });

                        const result = await response.json();
                        if (result.success) {
                            await this.loadData();
                            await this.loadStats();
                            alert('Mapping removed successfully!');
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (error) {
                        console.error('Error removing mapping:', error);
                        alert('Error removing mapping');
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
