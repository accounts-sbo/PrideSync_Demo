class PrideApp {
    constructor() {
        this.map = null;
        this.userLocation = null;
        this.boats = [];
        this.currentFrequency = 88.5;
        this.serverUrl = '/api';
        this.autoTuneEnabled = false;
        this.markers = [];
        
        this.init();
    }

    init() {
        this.initMap();
        this.bindEvents();
        this.startLocationTracking();
        this.loadBoats();
        this.startPeriodicUpdates();
    }

    initMap() {
        // Amsterdam centrum als default
        this.map = L.map('map').setView([52.3676, 4.9041], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add user location marker placeholder
        this.userMarker = null;
    }

    bindEvents() {
        document.getElementById('find-location').addEventListener('click', () => {
            this.getCurrentLocation();
        });
        
        document.getElementById('refresh-boats').addEventListener('click', () => {
            this.loadBoats();
        });

        document.getElementById('auto-tune').addEventListener('click', () => {
            this.toggleAutoTune();
        });
    }

    async getCurrentLocation() {
        try {
            const position = await this.getPosition();
            this.userLocation = {
                lat: position.coords.latitude,
                lon: position.coords.longitude
            };
            
            this.updateUserMarker();
            this.map.setView([this.userLocation.lat, this.userLocation.lon], 15);
            await this.updateNearestBoat();
            
            this.showStatus('Locatie gevonden!', 'success');
        } catch (error) {
            console.error('Geolocation error:', error);
            this.showStatus('Kon locatie niet bepalen', 'error');
        }
    }

    getPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
    }

    updateUserMarker() {
        if (this.userMarker) {
            this.map
                .removeLayer(this.userMarker);
        }
        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lon])
            .addTo(this.map)
            .bindPopup('Jouw locatie');
    }

    async loadBoats() {
        try {
            const response = await fetch(`${this.serverUrl}/boats`);
            this.boats = await response.json();
            this.displayBoatsOnMap();
        } catch (error) {
            console.error('Error loading boats:', error);
        }
    }

    displayBoatsOnMap() {
        this.boats.forEach(boat => {
            const marker = L.marker([boat.lat, boat.lon])
                .addTo(this.map)
                .bindPopup(`${boat.name}<br>Frequentie: ${boat.frequency || 'Niet toegewezen'} MHz`);
        });
    }

    async updateNearestBoat() {
        if (!this.userLocation) return;
        
        try {
            const response = await fetch(
                `${this.serverUrl}/locations/nearest?lat=${this.userLocation.lat}&lon=${this.userLocation.lon}`
            );
            const data = await response.json();
            
            this.currentFrequency = data.frequency;
            document.getElementById('current-frequency').textContent = `${data.frequency} MHz`;
            document.getElementById('nearest-boat').textContent = `Boot: ${data.boatId}`;
        } catch (error) {
            console.error('Error updating nearest boat:', error);
        }
    }

    startLocationTracking() {
        this.getCurrentLocation();
        setInterval(() => {
            if (this.userLocation) {
                this.updateNearestBoat();
            }
        }, 10000); // Update every 10 seconds
    }

    startPeriodicUpdates() {
        setInterval(() => {
            if (this.autoTuneEnabled && this.userLocation) {
                this.updateNearestBoat();
            }
        }, 5000); // Check every 5 seconds
    }

    toggleAutoTune() {
        this.autoTuneEnabled = !this.autoTuneEnabled;
        document.getElementById('auto-tune').textContent = 
            this.autoTuneEnabled ? 'Auto-tune: Aan' : 'Auto-tune: Uit';
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        setTimeout(() => {
            statusElement.textContent = '';
            statusElement.className = 'status';
        }, 3000);
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    new PrideApp();
});


