// Config is loaded globally via config.js

// --- State & Variables ---
let map;
let tempMarker;
let markers = [];
const feelingLayers = {
    'relaxed': new L.LayerGroup(),
    'happy': new L.LayerGroup(),
    'neutral': new L.LayerGroup(),
    'stressed': new L.LayerGroup()
};

// --- Config ---
const ZAGREB_COORDS = [45.815, 15.981];
const INITIAL_ZOOM = 13;

// --- Colors ---
const CATEGORY_COLORS = {
    'Priroda': '#22c55e', // Green
    'Voda': '#3b82f6',    // Blue
    'Ljudi': '#eab308',   // Yellow
    'Buka': '#ef4444'     // Red
};

// --- Icons ---
const getCategoryIcon = (category) => {
    switch (category) {
        case 'Priroda': return '🌲';
        case 'Voda': return '💧';
        case 'Ljudi': return '☕';
        case 'Buka': return '📢';
        default: return '📍';
    }
};

const getFeelingTag = (feeling) => {
    let type = 'neutral';
    let label = 'Neutralno';
    let iconName = 'meh';

    if (feeling.includes('😌')) {
        type = 'relaxed';
        label = 'Opušteno';
        iconName = 'smile';
    } else if (feeling.includes('😊')) {
        type = 'happy';
        label = 'Sretno';
        iconName = 'sun';
    } else if (feeling.includes('😖')) {
        type = 'stressed';
        label = 'Stresno';
        iconName = 'alert-octagon';
    }

    return `<div class="feeling-tag ${type}">
        <i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i>
        <span>${label}</span>
    </div>`;
};



// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupCloudinary();
    fetchMarkers();
    setupUI();
});

function initMap() {
    // 1. Create Map
    map = L.map('map').setView(ZAGREB_COORDS, INITIAL_ZOOM);

    // 2. Define Layers
    const darkMatter = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    });

    const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    });

    // 3. Add default layer
    darkMatter.addTo(map);

    // 4. Add Feeling Layers (All active by default)
    Object.values(feelingLayers).forEach(layer => layer.addTo(map));

    // 5. Layer Controls (Exposed for Custom Menu)
    window.baseLayers = {
        "dark": darkMatter,
        "light": positron,
        "topo": openTopo
    };
    // 5. Layer Controls (Standard for Desktop)
    const baseMapsDesktop = {
        "Dark Matter": darkMatter,
        "Positron": positron,
        "OpenTopoMap": openTopo
    };
    // Add default control (CSS will hide it on mobile)
    L.control.layers(baseMapsDesktop).addTo(map);

    // 5. Click Event (Disabled for Long Press)
    // map.on('click', onMapClick);

    // 6. Long Press Setup
    setupLongPressInteraction();

    // 6. Dynamic Logo & Icon Coloring
    const logo = document.getElementById('app-logo');
    const aboutBtn = document.getElementById('about-btn');

    // ... (keep existing theme logic) ...

    map.on('baselayerchange', (e) => {
        // ... (keep existing logic) ...
        const isLight = e.name !== 'Dark Matter';
        if (!isLight) { // Dark Mode
            logo.classList.add('invert-white');
            if (aboutBtn) aboutBtn.classList.remove('dark-icon');
            document.body.classList.add('dark-mode');
            document.body.classList.remove('light-mode');
        } else {
            logo.classList.remove('invert-white');
            if (aboutBtn) aboutBtn.classList.add('dark-icon');
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
        }
        updateMarkerStyles(isLight);
    });

    setupFilters();
}

// --- Long Press Interaction ---
function setupLongPressInteraction() {
    let pressTimer;
    let isPressing = false;
    let startX, startY;
    const PRESS_DURATION = 800;
    const MOVE_TOLERANCE = 15;
    const mapContainer = document.getElementById('map');

    // Prevent default context menu (long press menu)
    mapContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    const startPress = (e) => {
        // Ignore if target is control, popup, or marker
        if (e.target.closest('.leaflet-control-container') ||
            e.target.closest('.leaflet-popup-pane') ||
            e.target.closest('.leaflet-marker-icon')) return;

        isPressing = true;
        // Handle Mouse or Touch
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

        startX = clientX;
        startY = clientY;

        // Visual Feedback
        showLongPressIndicator(startX, startY);

        pressTimer = setTimeout(() => {
            if (isPressing) {
                triggerLongPressSuccess(startX, startY);
            }
        }, PRESS_DURATION);
    };

    const cancelPress = () => {
        if (!isPressing) return;
        isPressing = false;
        clearTimeout(pressTimer);
        hideLongPressIndicator();
    };

    const movePress = (e) => {
        if (!isPressing) return;
        const clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        const clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);

        const dist = Math.hypot(clientX - startX, clientY - startY);
        if (dist > MOVE_TOLERANCE) {
            cancelPress();
        }
    };

    // Attach DOM Events to Map Container
    mapContainer.addEventListener('mousedown', startPress);
    mapContainer.addEventListener('touchstart', startPress, { passive: true });

    mapContainer.addEventListener('mouseup', cancelPress);
    mapContainer.addEventListener('mouseleave', cancelPress);
    mapContainer.addEventListener('touchend', cancelPress);
    mapContainer.addEventListener('touchcancel', cancelPress);

    // Use window for move to catch fast movements out of element? No, map covers.
    mapContainer.addEventListener('mousemove', movePress);
    mapContainer.addEventListener('touchmove', movePress, { passive: true });

    // Leaflet Events to Cancel
    map.on('dragstart', cancelPress);
    map.on('zoomstart', cancelPress);
    map.on('movestart', cancelPress);
}

function showLongPressIndicator(x, y) {
    const indicator = document.createElement('div');
    indicator.className = 'long-press-indicator';
    indicator.style.left = x + 'px';
    indicator.style.top = y + 'px';
    document.body.appendChild(indicator);

    // Force reflow
    indicator.offsetHeight;

    // Add expanding class
    setTimeout(() => indicator.classList.add('expanding'), 10);
}

function hideLongPressIndicator() {
    const indicators = document.querySelectorAll('.long-press-indicator');
    indicators.forEach(el => el.remove());
}

function triggerLongPressSuccess(x, y) {
    isPressing = false;
    hideLongPressIndicator();

    // Haptic Feedback
    if (navigator.vibrate) navigator.vibrate(50); // Short pulse

    // Convert Screen Coords to Map LatLng
    const mapRect = document.getElementById('map').getBoundingClientRect();
    const relativeX = x - mapRect.left;
    const relativeY = y - mapRect.top;

    // Use Leaflet containerPointToLatLng
    const latlng = map.containerPointToLatLng([relativeX, relativeY]);
    const { lat, lng } = latlng;

    // Remove existing temp marker
    if (tempMarker) map.removeLayer(tempMarker);

    // Add new temp marker (Pin Drop)
    tempMarker = L.marker([lat, lng]).addTo(map);

    // Update Form
    document.getElementById('marker-lat').value = lat;
    document.getElementById('marker-lng').value = lng;

    const sheet = document.getElementById('input-sheet');
    const overlay = document.getElementById('sheet-overlay');

    sheet.classList.add('active');
    overlay.classList.remove('hidden');
    document.body.classList.add('sheet-open');
}

function closeBottomSheet() {
    const sheet = document.getElementById('input-sheet');
    const overlay = document.getElementById('sheet-overlay');

    sheet.classList.remove('active');
    overlay.classList.add('hidden');
    document.body.classList.remove('sheet-open');

    // Remove temp marker if operation cancelled? 
    // Usually yes, unless saved. But let's keep it until new one placed or user clears.
    // Ideally remove temp marker.
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
}
// OLD: onMapClick (Removed/Unused)
// function onMapClick(e) { ... }

// --- Cloudinary ---
let cloudinaryWidget;

function setupCloudinary() {
    if (!window.cloudinary) {
        console.error("Cloudinary script not loaded");
        return;
    }

    cloudinaryWidget = window.cloudinary.createUploadWidget({
        cloudName: CONFIG.CLOUDINARY_CLOUD_NAME,
        uploadPreset: CONFIG.CLOUDINARY_UPLOAD_PRESET,
        sources: ['local', 'url'],
        resourceType: 'auto',
        multiple: false,
        max_files: 1, // Explicitly limit to 1 file
        theme: 'minimal'
    }, (error, result) => {
        if (!error && result) {
            // Handle success event
            if (result.event === "success") {
                console.log('Upload success:', result.info);
                handleUploadSuccess(result.info);
                cloudinaryWidget.close();
            }
            // Handle queues-end event (fallback if success hangs)
            else if (result.event === "queues-end") {
                console.log('Queue ended');
                cloudinaryWidget.close();
            }
        }
    });

    document.getElementById('upload-btn').addEventListener('click', (e) => {
        e.preventDefault();
        cloudinaryWidget.open();
    });
}

// --- Audio Recorder Logic ---
let mediaRecorder;
let audioChunks = [];
let recordedBlob = null;

function setupRecorder() {
    console.log("Initializing Recorder...");

    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    let currentStream = null; // Track stream globally within closure to ensure we can stop it

    if (!recordBtn) {
        console.error("CRITICAL: Record button NOT found in DOM!");
        return;
    }

    const indicator = document.getElementById('recording-indicator');
    const audioPreview = document.getElementById('audio-preview');
    const statusEl = document.getElementById('upload-status');
    const submitBtn = document.getElementById('submit-btn');

    recordBtn.addEventListener('click', async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Vaš preglednik ne podržava snimanje zvuka. Koristite HTTPS ili noviji uređaj.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            currentStream = stream; // Store reference

            // Detect supported MIME type
            let options = {};
            if (MediaRecorder.isTypeSupported('audio/webm')) {
                options = { mimeType: 'audio/webm' };
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                options = { mimeType: 'audio/mp4' };
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                options = { mimeType: 'audio/aac' };
            } else {
                console.log("Using default MediaRecorder settings (no specific MIME type found).");
            }

            try {
                mediaRecorder = new MediaRecorder(stream, options);
            } catch (e) {
                console.error("Failed to create MediaRecorder with options, trying default:", e);
                mediaRecorder = new MediaRecorder(stream);
            }

            audioChunks = [];

            mediaRecorder.start();

            // UI Updates
            recordBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
            indicator.classList.remove('hidden');
            statusEl.textContent = "";
            audioPreview.classList.add('hidden');
            audioPreview.src = "";
            recordedBlob = null;
            document.getElementById('audioUrl').value = "";

            mediaRecorder.addEventListener("dataavailable", event => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            });

            mediaRecorder.addEventListener("stop", () => {
                try {
                    // Use the actual mime type from the recorder if available, or fall back
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    recordedBlob = new Blob(audioChunks, { type: mimeType });

                    const audioUrl = URL.createObjectURL(recordedBlob);
                    audioPreview.src = audioUrl;
                    audioPreview.classList.remove('hidden');

                    statusEl.textContent = "Zvuk snimljen! Spremno za spremanje.";
                    statusEl.style.color = "#FFD700";

                    // Stop all tracks to release mic
                    if (currentStream) {
                        currentStream.getTracks().forEach(track => track.stop());
                    }
                } catch (e) {
                    console.error("Error processing recording:", e);
                    statusEl.textContent = "Greška pri obradi snimke: " + e.message;
                    statusEl.style.color = "red";
                }

                // UI Reset
                stopBtn.classList.add('hidden');
                recordBtn.classList.remove('hidden');
                indicator.classList.add('hidden');
                recordBtn.innerHTML = '<span class="mic-icon">🔄</span> Snimi ponovno';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            });

            // Handle Recording Errors
            mediaRecorder.addEventListener("error", (e) => {
                console.error("MediaRecorder Error:", e);
                const errorMsg = e.error ? e.error.message : (e.message || "Nepoznata greška");
                alert("Greška snimača: " + errorMsg + "\nTip: " + (mediaRecorder.mimeType || 'default'));
            });

        } catch (err) {
            console.error("Error accessing microphone:", err);
            // Specifically detect legacy iOS or permission issues
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                alert("Pristup mikrofonu odbijen. Molimo dozvolite pristup u postavkama preglednika.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                alert("Mikrofon nije pronađen.");
            } else {
                alert("Greška pri pristupu mikrofonu: " + err.message);
            }
        }
    });

    stopBtn.addEventListener('click', () => {
        try {
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
            }
        } catch (e) {
            console.error("Error stopping recorder:", e);
        }
    });
}

function handleUploadSuccess(info) {
    const url = info.secure_url;
    document.getElementById('audioUrl').value = url;

    // UI Feedback
    const statusEl = document.getElementById('upload-status');
    statusEl.textContent = `Zvuk učitan! (${info.original_filename})`;

    // Enable submit
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
}

// --- User Interface ---
// --- User Interface ---
// const modal = document.getElementById('sound-modal'); // Legacy
const form = document.getElementById('add-marker-form');
// const closeBtn = document.querySelector('.close-btn'); // Legacy

function setupUI() {
    console.log("Setting up UI..."); // Debug Log
    // closeBtn.addEventListener('click', closeModal); // Legacy

    /*
    // Close modal on outside click (Handled by sheet logic now)
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    */

    if (form) form.addEventListener('submit', handleFormSubmit);

    // About Modal Logic
    const aboutBtn = document.getElementById('about-btn');
    const aboutModal = document.getElementById('about-modal');
    const aboutClose = document.querySelector('.about-close');

    aboutBtn.addEventListener('click', () => {
        aboutModal.classList.remove('hidden');
    });

    if (aboutClose) {
        aboutClose.addEventListener('click', () => {
            aboutModal.classList.add('hidden');
        });
    }

    // Close about modal on outside click (reusing window global click from shared logic if applicable or adding specific)
    // The shared window click handles 'modal' variable which is the sound modal.
    // Let's add specific handling or generic class handling.
    window.addEventListener('click', (event) => {
        if (event.target === aboutModal) {
            aboutModal.classList.add('hidden');
        }
    });
    // --- Bottom Sheet Logic ---
    // --- Bottom Sheet Logic ---
    // Use delegation for robustness
    document.addEventListener('click', (e) => {
        if (e.target.closest('#close-sheet-btn') || e.target.id === 'sheet-overlay') {
            e.preventDefault();
            closeBottomSheet();
        }
    });

    // Keep sidebar logic...
    const menuBtn = document.getElementById('menu-btn');
    const sideMenu = document.getElementById('side-menu');
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    const menuAboutBtn = document.getElementById('menu-about');

    function toggleMenu() {
        const isOpen = sideMenu.classList.contains('open');
        if (isOpen) {
            sideMenu.classList.remove('open');
            menuOverlay.classList.remove('open');
            document.body.classList.remove('menu-open'); // Restore UI
        } else {
            sideMenu.classList.add('open');
            menuOverlay.classList.add('open');
            document.body.classList.add('menu-open'); // Hide UI elements
        }
    }

    if (menuBtn) menuBtn.addEventListener('click', toggleMenu);
    if (closeMenuBtn) closeMenuBtn.addEventListener('click', toggleMenu);
    if (menuOverlay) menuOverlay.addEventListener('click', toggleMenu);

    // Menu Item: About Project
    if (menuAboutBtn) {
        menuAboutBtn.addEventListener('click', () => {
            toggleMenu(); // Close menu
            aboutModal.classList.remove('hidden'); // Open About modal
        });
    }

    // Menu Item: Layer Switching
    const layerButtons = document.querySelectorAll('.layer-select');
    layerButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const layerKey = btn.dataset.layer;
            const layer = window.baseLayers[layerKey];

            if (!layer) return;

            // Remove all base layers
            Object.values(window.baseLayers).forEach(l => {
                if (map.hasLayer(l)) map.removeLayer(l);
            });

            // Add selected layer
            map.addLayer(layer);

            // Update Active UI
            layerButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Trigger Theme Logic manually
            // We mimic the event object structure expected by the handler if we were reusing it,
            // or just duplicate the simple check since we know what 'dark'/'light'/'topo' implies.
            const isLight = (layerKey === 'light');

            // Update Logo/Theme classes
            const logo = document.getElementById('app-logo');
            const aboutBtn = document.getElementById('about-btn'); // Floating button

            if (!isLight) { // Dark Mode (Dark or Topo - Topo is kinda neutral but let's keep dark UI)
                logo.classList.add('invert-white');
                if (aboutBtn) aboutBtn.classList.remove('dark-icon');
                document.body.classList.add('dark-mode');
                document.body.classList.remove('light-mode');
            } else { // Light Mode
                logo.classList.remove('invert-white');
                if (aboutBtn) aboutBtn.classList.add('dark-icon');
                document.body.classList.remove('dark-mode');
                document.body.classList.add('light-mode');
            }

            // Also update marker styles if needed
            //  updateMarkerStyles(isLight); // Assumption: this helper exists or logic is inline? 
            // Checking previous code: updateMarkerStyles was called in baselayerchange.
            // I need to verify if updateMarkerStyles is defined globally.
            // In initMap it was called. It's likely a hoisted function or I should re-implement snippet.
            // Wait, looking at Step 1057, line 135: `updateMarkerStyles(isLight);`
            // I should find where `updateMarkerStyles` is defined. If it's inside `initMap`, I can't call it here.

            // Just in case, I will skip it or inline the logic if simple. 
            // However, the `baselayerchange` listener in `initMap` (lines 119-136) handles this. 
            // DOES map.addLayer trigger 'baselayerchange'? 
            // NO. It triggers 'layeradd'.
            // So manual update IS needed.
        });
    });

    // Locate Modal Logic
    const locateBtn = document.getElementById('locate-btn');

    locateBtn.addEventListener('click', () => {
        // High accuracy can be slow or fail on some non-GPS devices, but let's try standard first.
        // We set a timeout to avoid hanging indefinitely.
        map.locate({
            setView: true,
            maxZoom: 16,
            timeout: 10000,
            enableHighAccuracy: false // Changed to false to rely on WiFi/IP which is often better for desktops
        });
    });

    map.on('locationfound', (e) => {
        const radius = e.accuracy;

        // Remove previous location markers if they exist (optional, but good for cleanup)
        map.eachLayer(layer => {
            if (layer._isUserLocation) {
                map.removeLayer(layer);
            }
        });

        const circle = L.circle(e.latlng, radius, {
            color: '#FFD700',
            fillColor: '#FFD700',
            fillOpacity: 0.2
        });
        circle._isUserLocation = true; // Tag for removal
        circle.addTo(map);

        // Custom user location marker
        const marker = L.circleMarker(e.latlng, {
            radius: 8,
            fillColor: '#FFD700',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });
        marker._isUserLocation = true; // Tag for removal
        marker.addTo(map).bindPopup("Vi ste ovdje").openPopup();
    });

    map.on('locationerror', (e) => {
        console.error("Geolocation error:", e);
        let msg = "Greška pri lociranju.";

        // Leaflet wraps the native error code
        if (e.code === 1) { // PERMISSION_DENIED
            msg = "Nemamo dozvolu za pristup lokaciji. Molimo omogućite lokaciju u pregledniku.";
        } else if (e.code === 2) { // POSITION_UNAVAILABLE
            msg = "Lokacija nije dostupna. Provjerite GPS ili mrežnu vezu.";
        } else if (e.code === 3) { // TIMEOUT
            msg = "Vrijeme za lociranje je isteklo. Pokušajte ponovno.";
        } else {
            msg = `Nije moguće pronaći vašu lokaciju. (${e.message})`;
        }

        console.warn(msg); // Just log to console instead of alert
        // alert(msg); // Removed to prevent annoying popups
    });

    setupRecorder();
}

function openModal(lat, lng) {
    // Redirect to Bottom Sheet
    openBottomSheet(lat, lng);

    // Reset specific new form elements if needed (Sheet logic might handle values, but UI reset is good)
    form.reset();
    document.getElementById('upload-status').textContent = '';
    document.getElementById('audioUrl').value = '';
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.5';
    }

    // Reset Recorder UI
    const audioPreview = document.getElementById('audio-preview');
    if (audioPreview) {
        audioPreview.classList.add('hidden');
        audioPreview.src = "";
    }
    const recordBtn = document.getElementById('record-btn');
    if (recordBtn) {
        recordBtn.classList.remove('hidden');
        recordBtn.innerHTML = '<span class="mic-icon">🎙️</span> Snimi';
    }
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) stopBtn.classList.add('hidden');
    const recIndicator = document.getElementById('recording-indicator');
    if (recIndicator) recIndicator.classList.add('hidden');

    recordedBlob = null;
}

function closeModal() {
    // Redirect to Bottom Sheet Close
    closeBottomSheet();
    // Stop recording if active
    if (typeof mediaRecorder !== 'undefined' && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
}

// --- Data Handling (Google Sheets) ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.textContent = "Spremanje...";
    submitBtn.disabled = true;

    // Handle Blob Upload if needed
    if (recordedBlob && !document.getElementById('audioUrl').value) {
        try {
            document.getElementById('upload-status').textContent = "Upload snimke na Cloud...";
            const formData = new FormData();
            formData.append('file', recordedBlob, 'recording.webm');
            formData.append('upload_preset', CONFIG.CLOUDINARY_UPLOAD_PRESET);
            // Resource type auto or video usually works for audio chunks (webm)

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY_CLOUD_NAME}/video/upload`, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (result.secure_url) {
                // Force .mp3 extension for universal compatibility
                // Cloudinary will automatically transcode if we request a different extension
                const safeUrl = result.secure_url.replace(/\.[^/.]+$/, ".mp3");
                document.getElementById('audioUrl').value = safeUrl;
                console.log("Recorded audio uploaded:", safeUrl);
            } else {
                throw new Error("Cloudinary upload failed");
            }

        } catch (err) {
            console.error("Upload error:", err);
            alert("Greška pri uploadu snimke. Pokušajte ponovno.");
            submitBtn.textContent = "Spremi lokaciju";
            submitBtn.disabled = false;
            return;
        }
    }

    const formData = new FormData(form);
    const data = {
        lat: formData.get('lat'),
        lng: formData.get('lng'),
        category: formData.get('category'),
        feeling: formData.get('feeling'),
        comment: formData.get('comment'), // New field
        audioUrl: formData.get('audioUrl')
    };

    console.log("Submitting data:", data);

    // Optimistic UI: Add marker immediately
    addMarkerOnMap(data);
    closeModal();
    submitBtn.textContent = "Spremi lokaciju"; // Reset button for next time
    if (tempMarker) map.removeLayer(tempMarker);

    try {
        // We use 'no-cors' mode often for Apps Script if not properly managing CORS headers, 
        // but 'cors' is better if script handles options. 
        // Standard Apps Script POST usually requires following redirects or specific setup.
        // Simple POST with textual JSON payload:

        await fetch(CONFIG.APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', // Apps Script limits
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        console.log("Data sent to Sheets");
        // Note: no-cors means we can't read response.

    } catch (error) {
        console.error("Error saving marker:", error);
        alert("Greška pri spremanju. Provjerite konzolu.");
    }
}

async function fetchMarkers() {
    console.log("Fetching markers...");

    // 1. Try LocalStorage Cache first
    const cachedData = localStorage.getItem('min_ak_markers');
    let hasLoadedFromCache = false;

    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            console.log("Loaded from cache:", parsed.length);
            renderMarkers(parsed);
            hasLoadedFromCache = true;
            hideSplash(); // Show map immediately
        } catch (e) {
            console.warn("Cache parse error", e);
        }
    }

    // 2. Network Fetch (updates cache)
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL);
        const data = await response.json();
        const markerList = Array.isArray(data) ? data : (data.markers || []);

        console.log("Fetched new data:", markerList.length);

        // Update Cache
        localStorage.setItem('min_ak_markers', JSON.stringify(markerList));

        // Re-render only if different count or forced? 
        // For simplicity and correctness, we always re-render to show latest state.
        // Optimization: Could diff content, but re-render is safe.
        renderMarkers(markerList);

        if (!hasLoadedFromCache) {
            hideSplash();
        }

    } catch (error) {
        console.error("Error fetching markers:", error);
        if (!hasLoadedFromCache) {
            hideSplash(); // Hide anyway so user isn't stuck
            alert("Nije moguće učitati podatke. Prikazujem mapu.");
        }
    }
}

function clearMarkers() {
    // Remove all markers from layers
    Object.values(feelingLayers).forEach(layer => layer.clearLayers());

    // Remove any markers added directly to map (fallback)
    markers.forEach(m => {
        if (map.hasLayer(m)) map.removeLayer(m);
    });
    markers = [];
}

// --- Statistics Logic ---
// --- Statistics Logic ---
function updateStats(currentMarkers) {
    const total = currentMarkers.length;
    let html = '';

    if (total === 0) {
        html = `
        <div class="stat-item">
            <span>Ukupno:</span> <span class="stat-highlight">0</span>
        </div>
        <div class="separator-dot">•</div>
        <div class="stat-item">
            <span>Pomiči mapu za više podataka</span>
        </div>`;
    } else {
        const categories = {};
        const feelings = {};

        currentMarkers.forEach(m => {
            const cat = m.category || 'Nepoznato';
            const feel = m.feeling || 'Neutralno';

            categories[cat] = (categories[cat] || 0) + 1;
            feelings[feel] = (feelings[feel] || 0) + 1;
        });

        const dominantCategory = Object.keys(categories).reduce((a, b) => categories[a] > categories[b] ? a : b);
        const dominantFeeling = Object.keys(feelings).reduce((a, b) => feelings[a] > feelings[b] ? a : b);

        let feelLabel = dominantFeeling;
        if (feelLabel.includes('😌')) feelLabel = 'Opušteno 😌';
        else if (feelLabel.includes('😊')) feelLabel = 'Sretno 😊';
        else if (feelLabel.includes('😖')) feelLabel = 'Stresno 😖';
        else if (feelLabel.includes('😐')) feelLabel = 'Neutralno 😐';

        html = `
            <div class="stat-item">
                <span>Ukupno:</span> <span class="stat-highlight">${total}</span>
            </div>
            <div class="separator-dot">•</div>
            <div class="stat-item">
                <i data-lucide="chart-bar-big" width="16" height="16"></i> <span>Dominira:</span> <span class="stat-highlight">${dominantCategory}</span>
            </div>
            <div class="separator-dot">•</div>
            <div class="stat-item">
                <i data-lucide="sparkles" width="16" height="16"></i> <span>Vibra:</span> <span class="stat-highlight">${feelLabel}</span>
            </div>
        `;
    }

    const statusBar = document.getElementById('status-bar');
    if (statusBar) {
        statusBar.innerHTML = html;
        if (window.lucide) {
            lucide.createIcons();
        }
    }
}

function updateStatsFromView() {
    if (!map) return;
    const bounds = map.getBounds();
    const visibleMarkers = [];

    // Iterate through active feelingLayers
    Object.values(feelingLayers).forEach(layerGroup => {
        if (map.hasLayer(layerGroup)) {
            layerGroup.eachLayer(layer => {
                // Check if marker is in current view
                if (bounds.contains(layer.getLatLng()) && layer.feature) {
                    visibleMarkers.push(layer.feature);
                }
            });
        }
    });

    updateStats(visibleMarkers);
}

function setupStatsListeners() {
    map.off('moveend', updateStatsFromView);
    map.on('moveend', updateStatsFromView);
    map.on('zoomend', updateStatsFromView);
    map.on('overlayadd', updateStatsFromView);
    map.on('overlayremove', updateStatsFromView);
}

function renderMarkers(data) {
    clearMarkers();
    data.forEach(markerData => {
        addMarkerOnMap(markerData);
    });

    // Initialize dynamic stats
    setupStatsListeners();
    // Delay slightly to ensure map bounds are ready
    setTimeout(() => {
        updateStatsFromView();
    }, 100);
}

function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash) {
        splash.classList.add('hidden');
    }
}

// --- Helper Functions for Markers ---
function updateMarkerStyles(isLight) {
    markers.forEach(marker => {
        if (marker instanceof L.CircleMarker && !marker._isUserLocation) {
            // We need to know the original color which we stored in options
            const color = marker.options.originalColor;
            const style = getMarkerStyle(color, isLight);
            marker.setStyle(style);
        }
    });
}

const getMarkerStyle = (color, isLight) => {
    if (isLight) {
        return {
            fillColor: color,
            color: '#333', // Dark border
            weight: 1,      // Thinner border
            opacity: 0.8,
            fillOpacity: 0.9, // Fuller fill
            radius: 8
        };
    } else {
        // Dark Mode
        return {
            fillColor: color,
            color: color,   // Glow effect (same color border)
            weight: 2,      // Thicker border
            opacity: 1,
            fillOpacity: 0.6, // Glassy fill
            radius: 8
        };
    }
};

function addMarkerOnMap(data) {
    const { lat, lng, category, feeling, comment, audioUrl } = data;
    const color = CATEGORY_COLORS[category] || '#ffffff';
    // const iconChar = getCategoryIcon(category); // Not used in circle marker directly, handled in popup header
    const iconChar = getCategoryIcon(category);

    // Create random simplified address/date simulation if not present
    const dateStr = new Date().toLocaleDateString('hr-HR');
    const addressStr = `${lat.toString().slice(0, 7)}, ${lng.toString().slice(0, 7)}`;

    // Comment HTML if exists
    const commentHtml = comment ? `<p class="popup-comment">"${comment}"</p>` : '';

    const isLight = document.body.classList.contains('light-mode');
    const style = getMarkerStyle(color, isLight);

    const marker = L.circleMarker([lat, lng], style);

    // Attach metadata for dynamic stats
    marker.feature = { category, feeling };

    // Sort into Layer Groups
    let feelingKey = 'neutral';
    if (feeling.includes('😌')) feelingKey = 'relaxed';
    else if (feeling.includes('😊')) feelingKey = 'happy';
    else if (feeling.includes('😖')) feelingKey = 'stressed';
    else if (feeling.includes('😐')) feelingKey = 'neutral';

    // Add to specific layer group
    if (feelingLayers[feelingKey]) {
        feelingLayers[feelingKey].addLayer(marker);
    } else {
        map.addLayer(marker);
    }

    // Store original color for theme switching re-calculation
    marker.options.originalColor = color;

    // Generate unique ID for this marker's audio container
    const markerId = `marker-${lat.toString().replace('.', '')}-${lng.toString().replace('.', '')}-${Date.now()}`;
    const waveContainerId = `wave-${markerId}`;

    const feelingTagHtml = getFeelingTag(feeling); // Generate new tag

    // Create DOM element for popup content
    const container = document.createElement('div');

    container.innerHTML = `
        <div class="popup-header">
            <div class="category-icon">${iconChar}</div>
            <div class="popup-details">
                <h3 class="popup-title">Mapa zvuka</h3>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                    <span class="popup-category">${category}</span>
                    ${feelingTagHtml}
                </div>
                ${commentHtml}
            </div>
        </div>
        
        <div class="audio-player">
            <button class="play-btn">
                <div class="play-icon"></div>
                <div class="pause-icon"></div>
            </button>
            <div class="progress-container" id="${waveContainerId}">
                <!-- WaveSurfer renders here -->
            </div>
        </div>

        <div class="popup-footer">
            <span>${addressStr}</span>
            <span>${dateStr}</span>
        </div>
    `;

    // We need to keep track of the ws instance
    let wavesurfer = null;

    marker.bindPopup(container, {
        className: 'custom-popup',
        closeButton: false,
        minWidth: 300
    });

    marker.on('popupopen', () => {
        // Initialize Icons
        lucide.createIcons();

        // Initialize WaveSurfer when popup opens
        const waveContainer = document.getElementById(waveContainerId);
        const playBtn = container.querySelector('.play-btn');
        const playerContainer = container.querySelector('.audio-player');

        if (!waveContainer) return;

        // Determine colors based on theme
        const isLight = document.body.classList.contains('light-mode');
        // High contrast colors
        const waveColor = isLight ? 'rgba(0, 0, 0, 0.2)' : 'rgba(255, 255, 255, 0.2)';
        const progressColor = isLight ? '#b45309' : '#FFD700'; // Dark Amber (Light Mode) vs Gold (Dark Mode)

        wavesurfer = WaveSurfer.create({
            container: waveContainer,
            waveColor: waveColor,
            progressColor: progressColor,
            cursorColor: 'transparent',
            barWidth: 2,
            barRadius: 2,
            responsive: true,
            height: 30, // Fits nicely in our container
            normalize: true,
        });

        wavesurfer.load(audioUrl);

        wavesurfer.on('ready', () => {
            // Optional: Auto-play or just ready state
        });

        wavesurfer.on('play', () => {
            playerContainer.classList.add('playing');
        });

        wavesurfer.on('pause', () => {
            playerContainer.classList.remove('playing');
        });

        wavesurfer.on('finish', () => {
            playerContainer.classList.remove('playing');
        });

        playBtn.onclick = (e) => {
            e.stopPropagation();
            wavesurfer.playPause();
        };
    });

    marker.on('popupclose', () => {
        if (wavesurfer) {
            wavesurfer.destroy();
            wavesurfer = null;
        }
    });

    markers.push(marker);
}

function setupFilters() {
    console.log("Setting up Filters..."); // Debug
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const feelingKey = btn.dataset.feeling;
            const layer = feelingLayers[feelingKey];

            if (!layer) return;

            if (map.hasLayer(layer)) {
                map.removeLayer(layer);
                btn.classList.remove('active');
            } else {
                map.addLayer(layer);
                btn.classList.add('active');
            }
            // Update stats immediately after filter change
            updateStatsFromView();
        });
    });

    // Init Lucide icons in filters if needed
    if (window.lucide) {
        lucide.createIcons();
    }
}

