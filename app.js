/**
 * Geo Pothole Detection App Logic
 * Handles views, camera access, geolocation, and mapping
 */

// ==========================================
// STATE & DATA
// ==========================================
const state = {
    currentView: 'home',
    reportStep: 1,
    reportData: {
        image: null,
        location: null,
        address: '',
        description: '',
        severity: 'medium'
    },
    maps: {
        mini: null,
        main: null,
        miniMarker: null
    },
    mockData: [
        { id: 1, lat: 40.7128, lng: -74.0060, status: 'new', sev: 'high', date: '2 hours ago' },
        { id: 2, lat: 40.7200, lng: -73.9900, status: 'progress', sev: 'medium', date: 'Yesterday' },
        { id: 3, lat: 40.7050, lng: -74.0150, status: 'fixed', sev: 'low', date: '3 days ago' }
    ]
};

// ==========================================
// NAVIGATION (Tabs)
// ==========================================
function navigateTo(viewId) {
    if (state.currentView === viewId) return;

    // Hide all views
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    // Show target view
    document.getElementById(`view-${viewId}`).classList.add('active');
    
    // Update nav buttons
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`nav-${viewId}`).classList.add('active');

    state.currentView = viewId;

    // View-specific initialization
    if (viewId === 'report') {
        resetReportFlow();
    } else if (viewId === 'map') {
        setTimeout(initMainMap, 100); // Small delay to ensure container is visible for Leaflet sizing
    }
}

// ==========================================
// REPORT FLOW 
// ==========================================

function nextReportStep(stepNumber) {
    // Hide current step content
    document.querySelectorAll('.report-step').forEach(el => el.classList.remove('active'));
    // Show next step content
    document.getElementById(`report-step-${stepNumber}`).classList.add('active');
    
    // Update Indicators
    document.querySelectorAll('.step').forEach((el, index) => {
        if (index + 1 === stepNumber) {
            el.classList.add('active');
            el.classList.remove('completed');
        } else if (index + 1 < stepNumber) {
            el.classList.remove('active');
            el.classList.add('completed');
            // Check icon for completed
            el.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else {
            el.classList.remove('active', 'completed');
            el.innerHTML = index + 1;
        }
    });

    // Update lines
    document.querySelectorAll('.step-line').forEach((el, index) => {
        if (index + 1 < stepNumber) el.classList.add('active');
        else el.classList.remove('active');
    });

    state.reportStep = stepNumber;

    // Step-specific logic
    if (stepNumber === 2) {
        requestLocation();
    }
}

function resetReportFlow() {
    state.reportStep = 1;
    state.reportData = { image: null, location: null, address: '', description: '', severity: 'medium' };
    
    // Reset Image Preview
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('image-preview').src = '';
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('pothole-image').value = '';
    document.getElementById('btn-next-step-1').disabled = true;

    // Reset Form
    document.getElementById('pothole-address').value = '';
    document.getElementById('pothole-desc').value = '';
    selectSeverity('medium');

    // Go back to step 1
    nextReportStep(1);
}

// -> Step 1: Camera Logic
document.getElementById('pothole-image').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        // Create preview
        const reader = new FileReader();
        reader.onload = function(event) {
            const preview = document.getElementById('image-preview');
            preview.src = event.target.result;
            preview.style.display = 'block';
            document.getElementById('camera-placeholder').style.display = 'none';
            // Enable next button
            document.getElementById('btn-next-step-1').disabled = false;
            // Store locally
            state.reportData.image = file;
        };
        reader.readAsDataURL(file);
    }
});


// -> Step 2: Location & Mini Map Logic
function requestLocation() {
    const statusEl = document.getElementById('location-status');
    const btnNext = document.getElementById('btn-next-step-2');
    
    statusEl.className = 'location-status';
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Finding your exact location...';
    btnNext.disabled = true;

    if (!navigator.geolocation) {
        statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Geolocation not supported by browser.';
        statusEl.classList.add('error');
        initMiniMap(40.7128, -74.0060); // Default to NYC
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            state.reportData.location = { lat: latitude, lng: longitude };
            
            statusEl.className = 'location-status success';
            statusEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> Location acquired (accuracy: '+ Math.round(position.coords.accuracy) +'m)';
            btnNext.disabled = false;

            initMiniMap(latitude, longitude);
        },
        (error) => {
            console.error(error);
            statusEl.className = 'location-status text-warning';
            statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Could not get exact location. Please drag the pin manually.';
            btnNext.disabled = false; // Still allow them to proceed based on default/dragged pin
            initMiniMap(40.7128, -74.0060);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function initMiniMap(lat, lng) {
    // Make sure map isn't already initialized
    if (state.maps.mini) {
        state.maps.mini.setView([lat, lng], 17);
        if (state.maps.miniMarker) state.maps.miniMarker.setLatLng([lat, lng]);
        setTimeout(() => state.maps.mini.invalidateSize(), 50);
        return;
    }

    const mapEl = document.getElementById('report-map');
    
    // Create Map
    state.maps.mini = L.map(mapEl, {
        zoomControl: false // keep it clean
    }).setView([lat, lng], 17);

    // Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(state.maps.mini);

    // Draggable Marker
    const icon = L.divIcon({
        className: 'custom-pin',
        html: '<i class="fa-solid fa-location-dot" style="color: var(--danger); font-size: 2rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); transform: translateY(-50%)"></i>',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });

    state.maps.miniMarker = L.marker([lat, lng], { draggable: true, icon: icon }).addTo(state.maps.mini);

    // Update state on drag end
    state.maps.miniMarker.on('dragend', function(e) {
        const marker = e.target;
        const position = marker.getLatLng();
        state.reportData.location = { lat: position.lat, lng: position.lng };
    });

    // Fix grey map issue on container resize
    setTimeout(() => state.maps.mini.invalidateSize(), 150);
}


// -> Step 3: Details Logic
function selectSeverity(level) {
    state.reportData.severity = level;
    document.querySelectorAll('.sev-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.sev-btn.${level}`).classList.add('active');
}

function submitReport() {
    state.reportData.address = document.getElementById('pothole-address').value;
    state.reportData.description = document.getElementById('pothole-desc').value;
    
    // Show Loading
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.remove('hidden');

    // Simulate API Call (Upload Image, Save Data)
    setTimeout(() => {
        overlay.classList.add('hidden');
        
        // Show Success Step
        document.querySelectorAll('.report-step').forEach(el => el.classList.remove('active'));
        document.getElementById('report-success').classList.add('active');
        
        // Add to main map mock data
        if (state.reportData.location) {
            state.mockData.push({
                id: Date.now(),
                lat: state.reportData.location.lat,
                lng: state.reportData.location.lng,
                status: 'new',
                sev: state.reportData.severity,
                date: 'Just now'
            });
            // Update Activity Feed
            renderActivityFeed();
        }
        
    }, 1500);
}

function resetReportAndGoHome() {
    navigateTo('home');
}

// ==========================================
// MAIN MAP VIEW
// ==========================================
function initMainMap() {
    if (state.maps.main) {
        state.maps.main.invalidateSize();
        return;
    }

    const mapEl = document.getElementById('main-map');
    
    // Start at a default or current loc based on most recent activity
    const centerLat = state.mockData.length ? state.mockData[state.mockData.length-1].lat : 40.7128;
    const centerLng = state.mockData.length ? state.mockData[state.mockData.length-1].lng : -74.0060;

    state.maps.main = L.map(mapEl).setView([centerLat, centerLng], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(state.maps.main);

    // Add generic control
    L.control.zoom({ position: 'bottomright' }).addTo(state.maps.main);

    // Plot data
    plotMapData();

    setTimeout(() => state.maps.main.invalidateSize(), 200);
}

function plotMapData() {
    if (!state.maps.main) return;
    
    // Clear existing
    // In a real app we'd keep track of Layers to remove, but simple re-init for mock
    state.maps.main.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
            state.maps.main.removeLayer(layer);
        }
    });

    state.mockData.forEach(item => {
        let color = 'var(--danger)'; // new
        if (item.status === 'progress') color = 'var(--warning)';
        else if (item.status === 'fixed') color = 'var(--success)';

        const size = item.sev === 'high' ? '2.5rem' : (item.sev === 'medium' ? '2"rem' : '1.5rem');

        const icon = L.divIcon({
            className: 'custom-pin',
            html: `<i class="fa-solid fa-location-dot" style="color: ${color}; font-size: 2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); transform: translateY(-50%)"></i>`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
        });

        const popupContent = `
            <div style="text-align:center; font-family:'Inter', sans-serif;">
                <strong>${item.status.toUpperCase()}</strong><br>
                <span>Severity: ${item.sev}</span><br>
                <small style="color:var(--text-tertiary)">Reported: ${item.date}</small>
            </div>
        `;

        L.marker([item.lat, item.lng], { icon: icon })
            .bindPopup(popupContent)
            .addTo(state.maps.main);
    });
}

// ==========================================
// HOME VIEW FEED
// ==========================================
function renderActivityFeed() {
    const list = document.querySelector('.activity-list');
    list.innerHTML = '';
    
    // Reverse mock data to get newest first
    const recent = [...state.mockData].reverse().slice(0, 4);

    recent.forEach(item => {
        let iconClass = 'new';
        let iconHtml = '<i class="fa-solid fa-car-burst"></i>';
        let text = 'New pothole reported';

        if (item.status === 'progress') {
            iconClass = 'progress';
            iconHtml = '<i class="fa-solid fa-person-digging"></i>';
            text = 'Repair in progress';
        } else if (item.status === 'fixed') {
            iconClass = 'fixed';
            iconHtml = '<i class="fa-solid fa-check-double"></i>';
            text = 'Pothole fixed!';
        }

        const html = `
            <div class="activity-card">
                <div class="activity-icon ${iconClass}">
                    ${iconHtml}
                </div>
                <div class="activity-details">
                    <div class="activity-title">${text}</div>
                    <div class="activity-meta">
                        <span><i class="fa-regular fa-clock"></i> ${item.date}</span>
                        <span><i class="fa-solid fa-triangle-exclamation" style="color:${item.sev==='high'?'var(--danger)':'inherit'}"></i> ${item.sev} freq</span>
                    </div>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}

// Initialize Home Feed
document.addEventListener('DOMContentLoaded', () => {
    renderActivityFeed();
});
