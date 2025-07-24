import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAIMQbZZjIb-Z_sNJ4_7XhNz0DtiNnSSfg",
    authDomain: "shipment-bec8d.firebaseapp.com",
    projectId: "shipment-bec8d",
    storageBucket: "shipment-bec8d.appspot.com",
    messagingSenderId: "83538524138",
    appId: "1:83538524138:web:c06cf1b00915ea1f606493",
    measurementId: "G-XHDE3ZMCEY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Status configuration
const statusOrder = [
    "Shipment Created",
    "Shipped from India",
    "In Transit",
    "Reached Destination Country",
    "In Local Facility",
    "Out for Delivery",
    "Delivered"
];

const statusIcons = {
    "Shipment Created": "fas fa-box",
    "Shipped from India": "fas fa-ship",
    "In Transit": "fas fa-plane",
    "Reached Destination Country": "fas fa-flag-checkered",
    "In Local Facility": "fas fa-warehouse",
    "Out for Delivery": "fas fa-truck",
    "Delivered": "fas fa-check-circle"
};

const statusBadges = {
    "Shipment Created": "status-created",
    "Shipped from India": "status-shipped",
    "In Transit": "status-transit",
    "Reached Destination Country": "status-arrived",
    "In Local Facility": "status-arrived",
    "Out for Delivery": "status-delivery",
    "Delivered": "status-delivered"
};

// Courier configuration
const courierConfig = [
    {
        name: 'FedEx',
        pattern: /^(\d{12}|\d{15})$/,
        url: 'https://www.fedex.com/fedextrack/?trknbr='
    },
    // ... (other courier configurations remain the same)
];

// DOM Elements
const trackingForm = document.getElementById('trackingForm');
const loadingSpinner = document.getElementById('loadingSpinner');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const trackingResult = document.getElementById('trackingResult');
const timelineSteps = document.getElementById('timelineSteps');

// Helper functions
function showLoading() {
    loadingSpinner.style.display = 'block';
    errorMessage.style.display = 'none';
    trackingResult.style.display = 'none';
}

function hideLoading() {
    loadingSpinner.style.display = 'none';
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    trackingResult.style.display = 'none';
}

function formatDate(date) {
    if (!date) return '-';
    try {
        const options = {
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit', 
            minute: '2-digit'
        };
        return date.toLocaleDateString('en-US', options);
    } catch (e) {
        console.error("Date formatting error:", e);
        return '-';
    }
}

function detectCourier(awbNumber) {
    if (!awbNumber) return null;
    const cleanAwb = awbNumber.replace(/[ -]/g, '');
    return courierConfig.find(courier => courier.pattern.test(cleanAwb)) || null;
}

function redirectToCourierTracking(awbNumber) {
    const courier = detectCourier(awbNumber);
    if (courier) {
        window.open(courier.url + encodeURIComponent(awbNumber), '_blank');
    } else {
        window.open(`https://www.ship24.com/search?q=${encodeURIComponent(awbNumber)}`, '_blank');
    }
}

function createTimelineStep(status, isCompleted, isActive, historyItem) {
    const step = document.createElement('div');
    step.className = `timeline-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`;

    // Status title with icon
    const statusTitle = document.createElement('h4');
    const statusIcon = document.createElement('i');
    statusIcon.className = statusIcons[status] || 'fas fa-circle';
    statusTitle.appendChild(statusIcon);
    statusTitle.appendChild(document.createTextNode(' ' + status));
    step.appendChild(statusTitle);

    // Status description
    const statusDesc = document.createElement('p');
    
    if (isCompleted && historyItem) {
        statusDesc.textContent = historyItem.notes || 'Status updated';
        
        if (historyItem.timestamp) {
            try {
                const timestamp = historyItem.timestamp.toDate 
                    ? historyItem.timestamp.toDate() 
                    : new Date(historyItem.timestamp);
                const dateElem = document.createElement('span');
                dateElem.className = 'timeline-date';
                dateElem.innerHTML = `<i class="far fa-clock"></i> ${formatDate(timestamp)}`;
                step.appendChild(dateElem);
            } catch (e) {
                console.error("Error processing timestamp:", e);
            }
        }
    } else if (isActive) {
        statusDesc.textContent = 'Current status';
    } else {
        statusDesc.textContent = 'Pending';
    }

    step.appendChild(statusDesc);
    return step;
}

function displayShipmentDetails(shipment = {}) {
    // Basic shipment info
    document.getElementById('resultCustomerName').textContent = shipment.customerName || '-';
    document.getElementById('resultTrackingNumber').textContent = shipment.trackingNumber || '-';
    
    // Status with badge
    const status = shipment.status || 'Shipment Created';
    const badgeClass = statusBadges[status] || 'status-created';
    document.getElementById('resultStatus').className = 'value';
    document.getElementById('resultStatus').innerHTML = `${status} <span class="status-badge ${badgeClass}">${status}</span>`;
    
    // Other details
    document.getElementById('resultOrigin').textContent = shipment.origin || '-';
    document.getElementById('resultDestination').textContent = shipment.destination || '-';
    document.getElementById('resultWeight').textContent = shipment.weight ? `${shipment.weight} kg` : '-';
    
    // Last updated time
    let updatedAt = shipment.updatedAt || shipment.history?.[shipment.history.length - 1]?.timestamp;
    let updatedAtText = '-';
    if (updatedAt) {
        try {
            updatedAtText = formatDate(updatedAt.toDate ? updatedAt.toDate() : new Date(updatedAt));
        } catch (e) {
            console.error("Error formatting update date:", e);
        }
    }
    document.getElementById('resultUpdated').textContent = updatedAtText;

    // Forwarding AWB
    const forwardingAWBElement = document.getElementById('resultForwardingAWB');
    if (shipment.awbNumber) {
        const awbNumber = shipment.awbNumber;
        const courier = detectCourier(awbNumber) || shipment.forwardingCourier;
        const displayText = courier 
            ? `${typeof courier === 'string' ? courier : courier.name}: ${awbNumber}`
            : `AWB: ${awbNumber}`;
        
        forwardingAWBElement.innerHTML = `
            <a href="#" 
               onclick="redirectToCourierTracking('${awbNumber.replace(/'/g, "\\'")}'); return false;"
               style="color: #0066cc; text-decoration: underline; cursor: pointer;"
               title="${courier ? `Track on ${typeof courier === 'string' ? courier : courier.name}` : 'Track this AWB'}">
               ${displayText} <i class="fas fa-external-link-alt" style="font-size: 0.8em;"></i>
            </a>`;
    } else {
        forwardingAWBElement.textContent = 'Not assigned';
    }

    // Timeline display
    timelineSteps.innerHTML = '';
    
    let currentStatusIndex = statusOrder.indexOf(status);
    if (currentStatusIndex === -1) {
        console.warn("Status not found in statusOrder:", status);
        currentStatusIndex = 0;
    }
    
    const history = Array.isArray(shipment.history) ? shipment.history : [];
    
    statusOrder.forEach((status, idx) => {
        const isCompleted = idx < currentStatusIndex;
        const isActive = idx === currentStatusIndex;
        const historyItem = history.find(item => item && item.status === status);
        
        timelineSteps.appendChild(
            createTimelineStep(status, isCompleted, isActive, historyItem)
        );
    });
    
    // Animate timeline steps
    setTimeout(() => {
        const steps = document.querySelectorAll('.timeline-step');
        steps.forEach((step, index) => {
            setTimeout(() => {
                step.classList.add('animate');
            }, index * 200);
        });
    }, 100);
    
    errorMessage.style.display = 'none';
    trackingResult.style.display = 'block';
}

// Form submit handler
trackingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const trackingNumber = document.getElementById('trackingNumber').value.trim().toUpperCase();
    
    // Validation
    if (!trackingNumber.startsWith('SIC') || trackingNumber.length !== 11) {
        showError('Please enter a valid tracking number starting with SIC followed by 8 digits (e.g., SIC00000001).');
        return;
    }
    
    try {
        showLoading();
        const docRef = doc(db, 'shipments', trackingNumber);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            displayShipmentDetails(docSnap.data());
        } else {
            showError('No shipment found with this tracking number. Please check and try again.');
        }
    } catch (err) {
        console.error("Tracking error:", err);
        showError('An error occurred while fetching shipment details. Please try again later.');
    } finally {
        hideLoading();
    }
});

// Auto-tracking from URL parameter
function checkUrlTrackingRef() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingRef = urlParams.get('ref');
    
    if (trackingRef) {
        document.getElementById('trackingNumber').value = trackingRef.toUpperCase();
        autoTrackPackage(trackingRef);
    }
}

async function autoTrackPackage(trackingNumber) {
    const autoLoading = document.getElementById('auto-loading');
    let isLoading = true;
    
    let spinnerTimeout = setTimeout(() => { 
        if (isLoading && autoLoading) autoLoading.style.display = 'flex'; 
    }, 500);
    
    let requestTimeout = setTimeout(() => {
        if (isLoading) {
            isLoading = false;
            if (autoLoading) autoLoading.style.display = 'none';
            showError('Tracking request timed out. Please try again.');
        }
    }, 15000);
    
    try {
        trackingNumber = trackingNumber.trim().toUpperCase();
        
        if (!trackingNumber.startsWith('SIC') || trackingNumber.length !== 11) {
            showError('Invalid tracking number format');
            return;
        }
        
        showLoading();
        const docRef = doc(db, 'shipments', trackingNumber);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            displayShipmentDetails(docSnap.data());
        } else {
            showError('No shipment found with this tracking number');
        }
    } catch (error) {
        console.error("Auto-track error:", error);
        showError('An error occurred while fetching shipment details');
    } finally {
        clearTimeout(spinnerTimeout);
        clearTimeout(requestTimeout);
        isLoading = false;
        if (autoLoading) autoLoading.style.display = 'none';
        hideLoading();
    }
}

// Initialize the page
checkUrlTrackingRef();
window.redirectToCourierTracking = redirectToCourierTracking;
