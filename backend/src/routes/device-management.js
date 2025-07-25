const express = require('express');
const router = express.Router();
const { 
  getAllBoats, 
  getAllDeviceMappings, 
  createDeviceMapping, 
  updateDeviceMapping,
  getDeviceMappingByIMEI 
} = require('../models/database');
const logger = require('../services/logger');

/**
 * Get all device mappings with boat info
 */
router.get('/mappings', async (req, res) => {
  try {
    const mappings = await getAllDeviceMappings();
    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
  } catch (error) {
    logger.error('Error fetching device mappings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device mappings'
    });
  }
});

/**
 * Get all boats for dropdown
 */
router.get('/boats', async (req, res) => {
  try {
    const boats = await getAllBoats();
    res.json({
      success: true,
      data: boats.map(boat => ({
        id: boat.id,
        boat_number: boat.boat_number,
        name: boat.name,
        organisation: boat.organisation
      }))
    });
  } catch (error) {
    logger.error('Error fetching boats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch boats'
    });
  }
});

/**
 * Create new device mapping
 */
router.post('/mappings', async (req, res) => {
  try {
    const { boat_number, device_imei, device_serial, mac_address } = req.body;

    if (!boat_number || !device_imei) {
      return res.status(400).json({
        success: false,
        error: 'boat_number and device_imei are required'
      });
    }

    // Check if IMEI already exists
    const existing = await getDeviceMappingByIMEI(device_imei);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Device IMEI already mapped to another boat'
      });
    }

    const mapping = await createDeviceMapping({
      boat_number,
      device_imei,
      device_serial,
      mac_address,
      is_active: true
    });

    logger.info(`Device mapping created: IMEI ${device_imei} -> Boat ${boat_number}`);

    res.status(201).json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('Error creating device mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create device mapping'
    });
  }
});

/**
 * Update device mapping
 */
router.put('/mappings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    const mapping = await updateDeviceMapping(id, updateData);

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Device mapping not found'
      });
    }

    logger.info(`Device mapping updated: ${id}`);

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('Error updating device mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update device mapping'
    });
  }
});

/**
 * Toggle device mapping active status
 */
router.patch('/mappings/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const mapping = await updateDeviceMapping(id, { is_active });

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Device mapping not found'
      });
    }

    logger.info(`Device mapping ${is_active ? 'activated' : 'deactivated'}: ${id}`);

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('Error toggling device mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle device mapping'
    });
  }
});

/**
 * Get device mapping by IMEI
 */
router.get('/mappings/imei/:imei', async (req, res) => {
  try {
    const { imei } = req.params;
    const mapping = await getDeviceMappingByIMEI(imei);

    if (!mapping) {
      return res.status(404).json({
        success: false,
        error: 'Device mapping not found'
      });
    }

    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    logger.error('Error fetching device mapping by IMEI:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch device mapping'
    });
  }
});

/**
 * Serve CMS interface
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
            
            <!-- Add New Mapping Form -->
            <div class="bg-blue-50 rounded-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">Add New Device Mapping</h2>
                <form @submit.prevent="addMapping()" class="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Boat</label>
                        <select x-model="newMapping.boat_number" required class="w-full p-2 border border-gray-300 rounded-md">
                            <option value="">Select Boat</option>
                            <template x-for="boat in boats" :key="boat.boat_number">
                                <option :value="boat.boat_number" x-text="boat.boat_number + ' - ' + boat.name"></option>
                            </template>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">Device IMEI</label>
                        <input type="text" x-model="newMapping.device_imei" required 
                               class="w-full p-2 border border-gray-300 rounded-md" 
                               placeholder="353760970649317">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-2">MAC Address</label>
                        <input type="text" x-model="newMapping.mac_address" 
                               class="w-full p-2 border border-gray-300 rounded-md" 
                               placeholder="AA:BB:CC:DD:EE:FF">
                    </div>
                    <div class="flex items-end">
                        <button type="submit" class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
                            Add Mapping
                        </button>
                    </div>
                </form>
            </div>

            <!-- Mappings Table -->
            <div class="overflow-x-auto">
                <table class="min-w-full bg-white border border-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Boat</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device IMEI</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAC Address</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        <template x-for="mapping in mappings" :key="mapping.id">
                            <tr>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="text-sm font-medium text-gray-900" x-text="mapping.boat_number + ' - ' + mapping.boat_name"></div>
                                    <div class="text-sm text-gray-500" x-text="mapping.organisation"></div>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="mapping.device_imei"></td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900" x-text="mapping.mac_address || 'Not set'"></td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <span :class="mapping.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'" 
                                          class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                        <span x-text="mapping.is_active ? 'Active' : 'Inactive'"></span>
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button @click="toggleMapping(mapping)" 
                                            :class="mapping.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'"
                                            x-text="mapping.is_active ? 'Deactivate' : 'Activate'">
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
                boats: [],
                mappings: [],
                newMapping: {
                    boat_number: '',
                    device_imei: '',
                    mac_address: ''
                },

                async init() {
                    await this.loadBoats();
                    await this.loadMappings();
                },

                async loadBoats() {
                    try {
                        const response = await fetch('/api/device-management/boats');
                        const result = await response.json();
                        if (result.success) {
                            this.boats = result.data;
                        }
                    } catch (error) {
                        console.error('Error loading boats:', error);
                    }
                },

                async loadMappings() {
                    try {
                        const response = await fetch('/api/device-management/mappings');
                        const result = await response.json();
                        if (result.success) {
                            this.mappings = result.data;
                        }
                    } catch (error) {
                        console.error('Error loading mappings:', error);
                    }
                },

                async addMapping() {
                    try {
                        const response = await fetch('/api/device-management/mappings', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(this.newMapping)
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            this.newMapping = { boat_number: '', device_imei: '', mac_address: '' };
                            await this.loadMappings();
                            alert('Device mapping added successfully!');
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (error) {
                        console.error('Error adding mapping:', error);
                        alert('Error adding mapping');
                    }
                },

                async toggleMapping(mapping) {
                    try {
                        const response = await fetch('/api/device-management/mappings/' + mapping.id + '/toggle', {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ is_active: !mapping.is_active })
                        });
                        
                        const result = await response.json();
                        if (result.success) {
                            await this.loadMappings();
                        } else {
                            alert('Error: ' + result.error);
                        }
                    } catch (error) {
                        console.error('Error toggling mapping:', error);
                        alert('Error toggling mapping');
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
