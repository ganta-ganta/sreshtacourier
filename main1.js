import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAIMQbZZjIb-Z_sNJ4_7XhNz0DtiNnSSfg",
    authDomain: "shipment-bec8d.firebaseapp.com",
    projectId: "shipment-bec8d",
    storageBucket: "shipment-bec8d.appspot.com",
    messagingSenderId: "83538524138",
    appId: "1:83538524138:web:c06cf1b00915ea1f606493",
    measurementId: "G-XHDE3ZMCEY"
};

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

// Courier configuration with patterns and URLs
const courierConfig = [
    {
        name: 'FedEx',
        pattern: /^(\d{12}|\d{15})$/,
        url: 'https://www.fedex.com/fedextrack/?trknbr='
    },
    {
        name: 'DHL Express',
        pattern: /^(\d{10}|[0-9]{3}[ -]?[0-9]{4}[ -]?[0-9]{3})$/,
        url: 'https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id='
    },
    {
        name: 'UPS',
        pattern: /^(1Z[0-9A-Z]{16}|T[0-9]{10}|[0-9]{9})$/i,
        url: 'https://www.ups.com/track?loc=en_IN&tracknum='
    },
    {
        name: 'Blue Dart',
        pattern: /^(\d{8}|\d{11,12})$/,
        url: 'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo='
    },
    {
        name: 'DTDC',
        pattern: /^(\d{10,12})$/,
        url: 'https://www.dtdc.in/tracking/tracking_results.asp?Ttype=awb_no&strCnno='
    },
    {
        name: 'First Flight',
        pattern: /^(\d{8,12})$/,
        url: 'https://firstflight.net/track/?wbno='
    },
    {
        name: 'Aramex',
        pattern: /^(\d{8,13})$/,
        url: 'https://www.aramex.com/in/track/results?ShipmentNumber='
    },
    {
        name: 'Delhivery',
        pattern: /^(\d{10,12})$/,
        url: 'https://www.delhivery.com/track/package/'
    },
    {
        name: 'DPD',
        pattern: /^(\d{14}|[0-9]{12})$/,
        url: 'https://www.dpd.com/in/en/tracking/'
    },
    {
        name: 'India Post',
        pattern: /^[A-Z]{2}\d{9}[A-Z]{2}$/,
        url: 'https://www.indiapost.gov.in/_layouts/15/DOP.Portal.Tracking/TrackConsignment.aspx?ID='
    },
    {
        name: 'Amazon Shipping',
        pattern: /^AMZNIN\d{12}$/i,
        url: 'https://track.amazon.in/track/'
    }
];

// Helper functions
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'block';
    document.getElementById('trackingResult').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

function showError(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorMessage').style.display = 'flex';
    document.getElementById('trackingResult').style.display = 'none';
}

function formatDate(date) {
    if (!date) return '-';
    const options = {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

function detectCourier(awbNumber) {
    if (!awbNumber) return null;
    
    // Remove any spaces or hyphens from the AWB number
    const cleanAwb = awbNumber.replace(/[ -]/g, '');
    
    // Find the first courier that matches the pattern
    const matchedCourier = courierConfig.find(courier => 
        courier.pattern.test(cleanAwb)
    );
    
    return matchedCourier || null;
}

function redirectToCourierTracking(awbNumber) {
    const courier = detectCourier(awbNumber);
    
    if (courier) {
        // Construct the tracking URL
        const trackingUrl = courier.url + encodeURIComponent(awbNumber);
        window.open(trackingUrl, '_blank');
    } else {
        // Fallback to Ship24 for unknown AWB patterns
        const ship24Url = `https://www.ship24.com/search?q=${encodeURIComponent(awbNumber)}`;
        window.open(ship24Url, '_blank');
    }
}

function displayShipmentDetails(shipment = {}) {
    // Basic shipment info
    document.getElementById('resultCustomerName').textContent = shipment.customerName || '-';
    document.getElementById('resultTrackingNumber').textContent = shipment.trackingNumber || '-';
    
    // Status with badge
    const status = shipment.status || '-';
    const badgeClass = statusBadges[status] || 'status-created';
    document.getElementById('resultStatus').className = 'value';
    document.getElementById('resultStatus').innerHTML = `${status} <span class="status-badge ${badgeClass}">${status}</span>`;
    
    // Other details
    document.getElementById('resultOrigin').textContent = shipment.origin || '-';
    document.getElementById('resultDestination').textContent = shipment.destination || '-';
    document.getElementById('resultWeight').textContent = shipment.weight ? `${shipment.weight} kg` : '-';
    
    // Last updated time
    let updatedAtText = '-';
    if (shipment.updatedAt?.toDate) {
        updatedAtText = formatDate(shipment.updatedAt.toDate());
    }
    document.getElementById('resultUpdated').textContent = updatedAtText;

    // Forwarding AWB with auto-detection and redirect
    const forwardingAWBElement = document.getElementById('resultForwardingAWB');
    forwardingAWBElement.innerHTML = '-';
    
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
    const timelineSteps = document.getElementById('timelineSteps');
    timelineSteps.innerHTML = '';
    
    let currentStatusIndex = statusOrder.indexOf(shipment.status);
    
    statusOrder.forEach((status, idx) => {
        const step = document.createElement('div');
        step.className = 'timeline-step';
        
        if (idx < currentStatusIndex) step.classList.add('completed');
        else if (idx === currentStatusIndex) step.classList.add('active');
        
        const statusTitle = document.createElement('h4');
        const statusIcon = document.createElement('i');
        statusIcon.className = statusIcons[status] || 'fas fa-circle';
        statusTitle.appendChild(statusIcon);
        statusTitle.appendChild(document.createTextNode(' ' + status));
        step.appendChild(statusTitle);
        
        let statusDesc = document.createElement('p');
        const historyItem = shipment.history?.find(item => item.status === status);
        
        if (idx < currentStatusIndex && historyItem) {
            statusDesc.textContent = historyItem.notes || 'Status updated';
            
            if (historyItem.timestamp?.toDate) {
                const dateElem = document.createElement('span');
                dateElem.className = 'timeline-date';
                dateElem.innerHTML = `<i class="far fa-clock"></i> ${formatDate(historyItem.timestamp.toDate())}`;
                step.appendChild(dateElem);
            }
        } else if (idx === currentStatusIndex) {
            statusDesc.textContent = shipment.notes || 'Current status';
        } else {
            statusDesc.textContent = 'Pending';
        }
        
        step.appendChild(statusDesc);
        timelineSteps.appendChild(step);
    });
    
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('trackingResult').style.display = 'block';
}

// Form submit handler
document.getElementById('trackingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const trackingNumber = document.getElementById('trackingNumber').value.trim().toUpperCase();
    
    if (!trackingNumber.startsWith('SIC') || trackingNumber.length !== 11) {
        showError('Please enter a valid tracking number starting with SIC followed by 8 characters (e.g., SIC00000001).');
        return;
    }
    
    try {
        showLoading();
        const docRef = doc(db, 'shipments', trackingNumber);
        const docSnap = await getDoc(docRef);
        hideLoading();
        
        if (docSnap.exists()) {
            displayShipmentDetails(docSnap.data());
        } else {
            showError('No shipment found with this tracking number. Please check and try again.');
        }
    } catch (err) {
        hideLoading();
        showError('An error occurred while fetching shipment details. Please try again later.');
    }
});

// Auto-tracking from URL parameter
function checkUrlTrackingRef() {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingRef = urlParams.get('ref');
    
    if (trackingRef) {
        const trackingInput = document.getElementById('trackingNumber');
        if (trackingInput) {
            trackingInput.value = trackingRef.toUpperCase();
            autoTrackPackage(trackingRef);
        }
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
            showError('Tracking request timed out');
        }
    }, 10000);
    
    try {
        trackingNumber = trackingNumber.trim().toUpperCase();
        
        if (!trackingNumber.startsWith('SIC') || trackingNumber.length !== 11) {
            showError('Invalid tracking number format');
            clearTimeouts();
            return;
        }
        
        showLoading();
        const docRef = doc(db, 'shipments', trackingNumber);
        const docSnap = await getDoc(docRef);
        
        clearTimeouts();
        if (autoLoading) autoLoading.style.display = 'none';
        
        if (docSnap.exists()) {
            displayShipmentDetails(docSnap.data());
        } else {
            showError('No shipment found with this tracking number');
        }
    } catch (error) {
        clearTimeouts();
        if (autoLoading) autoLoading.style.display = 'none';
        showError('An error occurred while fetching shipment details');
    } finally {
        hideLoading();
    }
    
    function clearTimeouts() {
        clearTimeout(spinnerTimeout);
        clearTimeout(requestTimeout);
        isLoading = false;
    }
}

// Initialize the page and make functions available globally
checkUrlTrackingRef();
window.redirectToCourierTracking = redirectToCourierTracking;
window.handleForwardingAWBClick = redirectToCourierTracking; // For backward compatibility
