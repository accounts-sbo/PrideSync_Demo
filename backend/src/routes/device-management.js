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

    let mappingsCreated = 0;
    let errors = [];

    // Auto-mapping logic:
    // P1, P2, P3... -> Pride boats with parade_position 1, 2, 3...
    // O1, O2, O3... -> Pride boats with parade_position starting from next available
    // R1, R2, R3... -> Reserve trackers (no auto-mapping)

    for (const tracker of kpnTrackers) {
      try {
        const assetCode = tracker.asset_code;
        if (!assetCode) continue;

        let targetBoat = null;

        if (assetCode.startsWith('P')) {
          // Pride boats: P1 -> position 1, P2 -> position 2, etc.
          const position = parseInt(assetCode.substring(1));
          if (!isNaN(position)) {
            targetBoat = prideBoats.find(boat => boat.parade_position === position);
          }
        } else if (assetCode.startsWith('O')) {
          // Organization boats: O1 -> next available position after Pride boats
          const orgNumber = parseInt(assetCode.substring(1));
          if (!isNaN(orgNumber)) {
            const maxPridePosition = Math.max(...prideBoats.map(b => b.parade_position || 0));
            const targetPosition = maxPridePosition + orgNumber;
            targetBoat = prideBoats.find(boat => boat.parade_position === targetPosition);
          }
        }
        // R1, R2, etc. are reserve trackers - no auto-mapping

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
              notes: `Auto-mapped: ${assetCode} -> Position ${targetBoat.parade_position}`,
              is_active: true
            });

            mappingsCreated++;
          }
        }
      } catch (error) {
        errors.push(`Failed to map ${tracker.asset_code}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      message: `Auto-mapping completed. Created ${mappingsCreated} mappings.`,
      data: {
        mappings_created: mappingsCreated,
        errors: errors
      }
    });
  } catch (error) {
    logger.error('Error in auto-mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Auto-mapping failed',
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

            <!-- Statistics Dashboard -->
            <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-blue-600" x-text="stats.total_pride_boats"></div>
                    <div class="text-sm text-gray-600">Pride Boats</div>
                </div>
                <div class="bg-green-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-green-600" x-text="stats.total_kpn_trackers"></div>
                    <div class="text-sm text-gray-600">KPN Trackers</div>
                </div>
                <div class="bg-purple-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-purple-600" x-text="stats.active_mappings"></div>
                    <div class="text-sm text-gray-600">Active Mappings</div>
                </div>
                <div class="bg-yellow-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-yellow-600" x-text="stats.unmapped_boats"></div>
                    <div class="text-sm text-gray-600">Unmapped Boats</div>
                </div>
                <div class="bg-indigo-50 p-4 rounded-lg">
                    <div class="text-2xl font-bold text-indigo-600" x-text="stats.mapping_percentage + '%'"></div>
                    <div class="text-sm text-gray-600">Mapped</div>
                </div>
            </div>

            <!-- Auto-mapping Section -->
            <div class="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">🤖 Automatic Mapping</h2>
                <p class="text-gray-600 mb-4">Automatically map KPN trackers to Pride boats based on asset codes:</p>
                <ul class="text-sm text-gray-600 mb-4">
                    <li>• <strong>P1, P2, P3...</strong> → Pride boats at parade positions 1, 2, 3...</li>
                    <li>• <strong>O1, O2, O3...</strong> → Organization boats at next available positions</li>
                    <li>• <strong>R1, R2, R3...</strong> → Reserve trackers (no auto-mapping)</li>
                </ul>
                <button @click="autoMap()" class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-md hover:from-blue-700 hover:to-purple-700">
                    🚀 Start Auto-Mapping
                </button>
            </div>

            <!-- Manual Mapping Section -->
            <div class="bg-gray-50 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">Manual Mapping</h2>
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
                        const response = await fetch('/api/device-management/auto-map', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        const result = await response.json();
                        if (result.success) {
                            alert(result.message);
                            await this.loadData();
                            await this.loadStats();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (error) {
                        console.error('Error in auto-mapping:', error);
                        alert('Error in auto-mapping');
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
