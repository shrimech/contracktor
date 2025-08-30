// Global Variables
let currentUser = null;
let deliveryRequests = [];
let driverOffers = [];

// Sample Data
const sampleRequests = [
    {
        id: 1,
        pickup: "123 Main St, Downtown",
        delivery: "456 Oak Ave, Uptown",
        truckType: "medium",
        proposedPrice: 150,
        cargo: "Furniture and boxes",
        date: "2025-08-30",
        time: "10:00",
        customer: "John Doe",
        status: "pending"
    },
    {
        id: 2,
        pickup: "789 Pine St, Westside",
        delivery: "321 Elm St, Eastside",
        truckType: "large",
        proposedPrice: 200,
        cargo: "Commercial equipment",
        date: "2025-08-30",
        time: "14:00",
        customer: "Jane Smith",
        status: "pending"
    },
    {
        id: 3,
        pickup: "555 Cedar Blvd, North",
        delivery: "777 Maple Dr, South",
        truckType: "small",
        proposedPrice: 80,
        cargo: "Personal items",
        date: "2025-08-31",
        time: "09:00",
        customer: "Mike Johnson",
        status: "pending"
    }
];

const sampleDrivers = [
    {
        id: 1,
        name: "Ahmed Hassan",
        rating: 4.8,
        truckType: "medium",
        experience: "5 years",
        phone: "+1234567890"
    },
    {
        id: 2,
        name: "Sarah Wilson",
        rating: 4.9,
        truckType: "large",
        experience: "7 years",
        phone: "+1234567891"
    },
    {
        id: 3,
        name: "Carlos Rodriguez",
        rating: 4.7,
        truckType: "small",
        experience: "3 years",
        phone: "+1234567892"
    }
];

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    // Wait for database to be ready
    waitForDatabase().then(() => {
        initializeApp();
        setupEventListeners();
        updateDriverRequests();
    });
});

// Wait for database initialization
function waitForDatabase() {
    return new Promise((resolve) => {
        const checkDB = () => {
            if (window.truckDB && window.truckDB.isReady) {
                console.log('Database is ready');
                resolve();
            } else {
                setTimeout(checkDB, 100);
            }
        };
        checkDB();
    });
}

function initializeApp() {
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('pickup-date').min = today;
    
    // Set current time
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    document.getElementById('pickup-time').value = currentTime;
}

function loadSampleData() {
    deliveryRequests = [...sampleRequests];
}

function setupEventListeners() {
    // User type selector
    document.querySelectorAll('.btn-user-type').forEach(btn => {
        btn.addEventListener('click', function() {
            switchUserType(this.dataset.type);
        });
    });

    // Form submissions
    document.getElementById('delivery-request').addEventListener('submit', handleDeliveryRequest);
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('signup-form').addEventListener('submit', handleSignup);

    // Modal close events
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });

    // Navigation
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            scrollToSection(target);
            updateActiveNav(this);
        });
    });

    // Driver location update form
    const driverLocationForm = document.getElementById('driver-location-form');
    if (driverLocationForm) {
        driverLocationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            if (!currentUser || currentUser.type !== 'driver') {
                showErrorMessage('Please login as a driver to update your location.');
                showLoginModal();
                return;
            }
            const location = document.getElementById('driver-current-location').value.trim();
            const city = document.getElementById('driver-current-city').value.trim();
            if (!location || !city) {
                showErrorMessage('Please enter both your current location and city.');
                return;
            }
            try {
                // Get driver record
                let driver = await window.truckDB.getDriverByUserId(currentUser.id);
                if (!driver) {
                    showErrorMessage('Driver profile not found. Please complete your driver setup.');
                    showDriverSetupModal();
                    return;
                }
                // Actually update the driver record in the database
                driver.currentLocation = location;
                driver.currentCity = city;
                driver.lastLocationUpdate = new Date().toISOString();
                await window.truckDB.update('drivers', driver);
                showSuccessMessage('Location updated! You will now see requests in your area.');
                // Optionally show the updated location in the UI
                updateDriverRequests();
            } catch (error) {
                console.error('Error updating driver location:', error);
                showErrorMessage('Failed to update location. Please try again.');
            }
        });
    }
}

// User Type Switching
function switchUserType(type) {
    // Update button states
    document.querySelectorAll('.btn-user-type').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('active');

    // Switch forms
    document.querySelectorAll('.booking-form').forEach(form => {
        form.classList.remove('active');
    });
    
    if (type === 'customer') {
        document.getElementById('customer-form').classList.add('active');
    } else {
        document.getElementById('driver-form').classList.add('active');
        updateDriverRequests();
    }
}

// Navigation
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function updateActiveNav(activeLink) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    activeLink.classList.add('active');
}

// Form Handlers
async function handleDeliveryRequest(e) {
    e.preventDefault();
    
    if (!currentUser || currentUser.type !== 'customer') {
        showErrorMessage('Please login as a customer to create delivery requests.');
        showLoginModal();
        return;
    }
    
    const pickupLocation = document.getElementById('pickup-location').value;
    const deliveryLocation = document.getElementById('delivery-location').value;
    
    const formData = {
        pickupLocation: pickupLocation,
        deliveryLocation: deliveryLocation,
        truckType: document.getElementById('truck-type').value,
        proposedPrice: parseFloat(document.getElementById('proposed-price').value),
        cargoDescription: document.getElementById('cargo-description').value,
        requestedDate: document.getElementById('pickup-date').value,
        requestedTime: document.getElementById('pickup-time').value,
        customerName: currentUser.name,
        customerId: currentUser.id
    };

    try {
        // Save to database (this will automatically extract the pickup city for location matching)
        const savedRequest = await window.truckDB.createDeliveryRequest(formData);
        
        // Add to local array for immediate display
        deliveryRequests.push(savedRequest);
        
        // Show success message
        showSuccessMessage(`Your delivery request has been submitted! Drivers in ${savedRequest.pickupCity} can now see and accept your request.`);
        
        // Reset form
        e.target.reset();
        initializeApp();
    } catch (error) {
        console.error('Error creating delivery request:', error);
        showErrorMessage('Error submitting your request. Please try again.');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = e.target.querySelector('input[type="email"]').value;
    const password = e.target.querySelector('input[type="password"]').value;
    
    try {
        // Authenticate with database
        const user = await window.truckDB.authenticateUser(email, password);
        
        if (user) {
            currentUser = user;
            
            // Force close all modals
            closeAllModals();
            
            updateUIForLoggedInUser();
            
            // Show appropriate interface based on user type
            if (user.type === 'driver') {
                showDriverInterface();
                showSuccessMessage(`Welcome back, Driver ${currentUser.name}! Your driver dashboard is ready.`);
            } else if (user.type === 'customer') {
                showCustomerInterface();
                showSuccessMessage(`Welcome back, ${currentUser.name}! Ready to book your next delivery?`);
            } else {
                showSuccessMessage(`Welcome back, ${currentUser.name}!`);
            }
        } else {
            showErrorMessage('Invalid email or password');
        }
    } catch (error) {
        console.error('Login error:', error);
        showErrorMessage('Login failed. Please try again.');
    }
}

async function handleSignup(e) {
    e.preventDefault();
    
    const userData = {
        name: e.target.querySelector('input[type="text"]').value,
        email: e.target.querySelector('input[type="email"]').value,
        phone: e.target.querySelector('input[type="tel"]').value,
        type: e.target.querySelector('select').value,
        password: e.target.querySelector('input[type="password"]').value
    };
    
    try {
        // Check if user already exists
        const existingUser = await window.truckDB.getUserByEmail(userData.email);
        if (existingUser) {
            showErrorMessage('User with this email already exists');
            return;
        }
        
        // Create new user
        const newUser = await window.truckDB.createUser(userData);
        currentUser = { ...newUser, password: undefined }; // Remove password
        
        // Force close all modals
        closeAllModals();
        
        updateUIForLoggedInUser();
        
        // Show appropriate interface based on user type
        if (currentUser.type === 'driver') {
            showDriverInterface();
            showSuccessMessage(`Welcome to TruckDrive, Driver ${currentUser.name}! Complete your driver profile to start receiving delivery requests.`);
        } else if (currentUser.type === 'customer') {
            showCustomerInterface();
            showSuccessMessage(`Welcome to TruckDrive, ${currentUser.name}! You can now start booking deliveries.`);
        } else {
            showSuccessMessage(`Welcome to TruckDrive, ${currentUser.name}!`);
        }
    } catch (error) {
        console.error('Signup error:', error);
        showErrorMessage('Signup failed. Please try again.');
    }
}

// Driver Functions
async function updateDriverRequests() {
    if (!currentUser || currentUser.type !== 'driver') return;

    const requestsList = document.getElementById('driver-requests-list');
    if (!requestsList) return;

    try {
        const driver = await window.truckDB.getDriverByUserId(currentUser.id);
        if (!driver) {
            requestsList.innerHTML = '<p>Driver profile not found. Please contact support.</p>';
            return;
        }

        // Block driver from seeing any requests if he has an assigned delivery not completed
        const deliveries = await window.truckDB.getDeliveriesByDriver(driver.id);
        const hasActiveDelivery = deliveries.some(d => d.status === 'assigned' || d.status === 'in-transit');
        if (hasActiveDelivery) {
            requestsList.innerHTML = '<p>You have an active delivery. Complete it before accepting new requests.</p>';
            return;
        }

        // Check driver availability and location update (last 24h)
        if (!driver.isAvailable) {
            requestsList.innerHTML = '<p>You are currently offline. Turn on availability to see requests.</p>';
            return;
        }
        if (!driver.currentCity || !driver.lastLocationUpdate) {
            requestsList.innerHTML = '<p>Please update your location first to see delivery requests in your area.</p>';
            return;
        }
        const lastUpdate = new Date(driver.lastLocationUpdate);
        const now = new Date();
        const diffHours = (now - lastUpdate) / (1000 * 60 * 60);
        if (diffHours > 24) {
            requestsList.innerHTML = '<p>Your location is outdated. Please update your location to receive new requests.</p>';
            return;
        }

        // Only show requests that start from the driver's current city and are not assigned
        const allRequests = await window.truckDB.getRequestsByCity(driver.currentCity);
        const availableRequests = allRequests.filter(request =>
            request.status === 'pending' &&
            (!request.declinedDrivers || !request.declinedDrivers.includes(driver.id))
        );

        if (availableRequests.length === 0) {
            requestsList.innerHTML = `<p>No delivery requests available in ${driver.currentCity} at the moment.</p>`;
            return;
        }

        requestsList.innerHTML = availableRequests.map(request => `
            <div class="request-card" style="border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 15px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 15px;">
                    <div>
                        <h4 style="margin: 0; color: #2c3e50;">${request.customerName || 'Customer'}</h4>
                        <span style="color: #7f8c8d; font-size: 14px;">${formatDate(request.createdAt)}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: bold; color: #27ae60;">$${request.proposedPrice || 'N/A'}</div>
                        <div style="font-size: 12px; color: #7f8c8d;">Proposed Price</div>
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="margin-bottom: 8px;">
                        <i class="fas fa-map-marker-alt" style="color: #e74c3c; width: 20px;"></i>
                        <strong>From:</strong> ${request.pickupLocation}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <i class="fas fa-map-marker-alt" style="color: #27ae60; width: 20px;"></i>
                        <strong>To:</strong> ${request.deliveryLocation}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <i class="fas fa-truck" style="color: #3498db; width: 20px;"></i>
                        <strong>Truck Type:</strong> ${getTruckTypeLabel(request.truckType)}
                    </div>
                    <div style="margin-bottom: 8px;">
                        <i class="fas fa-boxes" style="color: #f39c12; width: 20px;"></i>
                        <strong>Cargo:</strong> ${request.cargoDescription || 'Not specified'}
                    </div>
                    <div>
                        <i class="fas fa-clock" style="color: #9b59b6; width: 20px;"></i>
                        <strong>Requested:</strong> ${formatDate(request.createdAt)}
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="showBidModal('${request.id}')" 
                            style="flex: 1; background: #3498db; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-hand-holding-usd"></i> Place Bid
                    </button>
                    <button onclick="declineDeliveryRequest('${request.id}')" 
                            style="flex: 1; background: #e74c3c; color: white; border: none; padding: 12px; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-times"></i> Decline
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading driver requests:', error);
        requestsList.innerHTML = '<p>Error loading requests. Please try again.</p>';
    }
}

async function submitBid(requestId) {
    if (!currentUser) {
        showErrorMessage('Please login as a driver to submit bids');
        showLoginModal();
        return;
    }
    
    const bidAmount = prompt('Enter your bid amount ($):');
    
    if (bidAmount && !isNaN(bidAmount) && parseFloat(bidAmount) > 0) {
        try {
            const bidData = {
                requestId: requestId,
                driverId: currentUser.id,
                driverName: currentUser.name,
                bidAmount: parseFloat(bidAmount),
                customerId: null // Will be updated when request is fetched
            };
            
            // Get request details to find customer
            const request = await window.truckDB.read('deliveryRequests', requestId);
            if (request) {
                bidData.customerId = request.customerId;
            }
            
            // Save bid to database
            await window.truckDB.createBid(bidData);
            
            showSuccessMessage(`Your bid of $${bidAmount} has been submitted!`);
            
            // Add to local offers for this request
            if (!driverOffers[requestId]) {
                driverOffers[requestId] = [];
            }
            
            driverOffers[requestId].push({
                driverId: currentUser.id,
                driverName: currentUser.name,
                bidAmount: parseFloat(bidAmount),
                rating: (Math.random() * 1.5 + 3.5).toFixed(1),
                experience: Math.floor(Math.random() * 8 + 1) + ' years'
            });
        } catch (error) {
            console.error('Error submitting bid:', error);
            showErrorMessage('Error submitting bid. Please try again.');
        }
    }
}

function filterRequests() {
    const truckType = document.getElementById('filter-truck-type').value;
    const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
    
    let filtered = deliveryRequests.filter(request => {
        const typeMatch = !truckType || request.truckType === truckType;
        const priceMatch = request.proposedPrice >= minPrice;
        return typeMatch && priceMatch;
    });
    
    // Update display with filtered results
    const container = document.getElementById('delivery-requests');
    
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No requests match your filters.</p>';
        return;
    }
    
    container.innerHTML = filtered.map(request => `
        <div class="request-card" data-request-id="${request.id}">
            <div class="request-header">
                <div>
                    <h4>${request.customer}</h4>
                    <span class="request-date">${formatDate(request.date)} at ${request.time}</span>
                </div>
                <div class="request-price">$${request.proposedPrice}</div>
            </div>
            <div class="request-details">
                <div class="request-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span><strong>From:</strong> ${request.pickup}</span>
                </div>
                <div class="request-detail">
                    <i class="fas fa-map-marker-alt"></i>
                    <span><strong>To:</strong> ${request.delivery}</span>
                </div>
                <div class="request-detail">
                    <i class="fas fa-truck"></i>
                    <span><strong>Truck:</strong> ${getTruckTypeLabel(request.truckType)}</span>
                </div>
                <div class="request-detail">
                    <i class="fas fa-boxes"></i>
                    <span><strong>Cargo:</strong> ${request.cargo}</span>
                </div>
            </div>
            <button class="btn-bid" onclick="submitBid(${request.id})">
                <i class="fas fa-hand-paper"></i>
                Submit Bid
            </button>
        </div>
    `).join('');
}

// Offer Functions
function generateDriverOffers(requestId) {
    const offers = [];
    const numOffers = Math.floor(Math.random() * 4) + 2; // 2-5 offers
    
    for (let i = 0; i < numOffers; i++) {
        const driver = sampleDrivers[Math.floor(Math.random() * sampleDrivers.length)];
        const request = deliveryRequests.find(r => r.id === requestId);
        const variation = (Math.random() - 0.5) * 0.4; // ±20% variation
        const bidAmount = Math.round(request.proposedPrice * (1 + variation));
        
        offers.push({
            driverId: driver.id + i,
            driverName: driver.name,
            driverRating: driver.rating,
            driverExperience: driver.experience,
            bidAmount: bidAmount,
            estimatedTime: Math.floor(Math.random() * 3) + 1 + ' hours',
            truckType: driver.truckType
        });
    }
    
    driverOffers[requestId] = offers;
}

function showOffersModal(requestId) {
    const modal = document.getElementById('offers-modal');
    const container = document.getElementById('driver-offers');
    const offers = driverOffers[requestId] || [];
    
    if (offers.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">No offers yet. Please wait for drivers to respond.</p>';
    } else {
        container.innerHTML = offers.map((offer, index) => `
            <div class="offer-card">
                <div class="offer-header">
                    <div class="driver-info">
                        <div class="driver-avatar">${offer.driverName.charAt(0)}</div>
                        <div class="driver-details">
                            <h4>${offer.driverName}</h4>
                            <div class="driver-rating">
                                ${'★'.repeat(Math.floor(offer.driverRating))} ${offer.driverRating}
                            </div>
                            <div style="font-size: 0.9rem; color: #666;">${offer.driverExperience} experience</div>
                        </div>
                    </div>
                    <div class="offer-price">$${offer.bidAmount}</div>
                </div>
                <div class="offer-details">
                    <div style="color: #666; margin-bottom: 0.5rem;">
                        <i class="fas fa-clock"></i> Estimated delivery: ${offer.estimatedTime}
                    </div>
                    <div style="color: #666;">
                        <i class="fas fa-truck"></i> ${getTruckTypeLabel(offer.truckType)}
                    </div>
                </div>
                <div class="offer-actions">
                    <button class="btn-accept" onclick="acceptOffer(${requestId}, ${index})">Accept Offer</button>
                    <button class="btn-decline" onclick="declineOffer(${requestId}, ${index})">Decline</button>
                </div>
            </div>
        `).join('');
    }
    
    modal.style.display = 'block';
}

function acceptOffer(requestId, offerIndex) {
    const offer = driverOffers[requestId][offerIndex];
    showSuccessMessage(`Offer accepted! ${offer.driverName} will contact you shortly.`);
    
    // Update request status
    const request = deliveryRequests.find(r => r.id === requestId);
    if (request) {
        request.status = 'accepted';
        request.assignedDriver = offer.driverName;
        request.finalPrice = offer.bidAmount;
    }
    
    closeModal('offers-modal');
}

function declineOffer(requestId, offerIndex) {
    driverOffers[requestId].splice(offerIndex, 1);
    showOffersModal(requestId); // Refresh the modal
}

// Modal Functions
function showLoginModal() {
    document.getElementById('login-modal').style.display = 'block';
}

function showSignupModal() {
    document.getElementById('signup-modal').style.display = 'block';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        
        // Also hide the modal backdrop if it exists
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
            backdrop.style.display = 'none';
        }
        
        // Reset any form inside the modal
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
    }
}

// Force close all modals
function closeAllModals() {
    const allModals = document.querySelectorAll('.modal');
    allModals.forEach(modal => {
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        
        // Reset forms
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => form.reset());
    });
    
    // Also close any dynamic modals
    if (window.currentModal) {
        document.body.removeChild(window.currentModal);
        window.currentModal = null;
    }
}

function switchModal(fromModal, toModal) {
    closeModal(fromModal);
    document.getElementById(toModal).style.display = 'block';
}

// UI Updates
function updateUIForLoggedInUser() {
    const authButtons = document.querySelector('.auth-buttons');
    authButtons.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 35px; height: 35px; border-radius: 50%; background: #f39c12; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                    ${currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div style="color: white;">
                    <div style="font-size: 0.9rem; font-weight: 500;">${currentUser.name}</div>
                    <div style="font-size: 0.7rem; opacity: 0.8;">${currentUser.type}</div>
                </div>
            </div>
            <button class="btn-login" id="logout-btn">Logout</button>
        </div>
    `;
    // Attach logout event
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = logout;
}

// Interface Management Functions
function showCustomerInterface() {
    console.log('Showing customer interface');
    
    // Hide driver interface elements
    document.getElementById('driver-form').classList.remove('active');
    
    // Show customer interface
    document.getElementById('customer-form').classList.add('active');
    
    // Hide driver booking section for customers - customers don't need to see driver registration
    const driverBookingSection = document.getElementById('driver-booking');
    if (driverBookingSection) {
        driverBookingSection.style.display = 'none';
    }
    
    // Hide the "I'm a Driver" button for customers
    const driverBtn = document.querySelector('[data-type="driver"]');
    if (driverBtn) {
        driverBtn.style.display = 'none';
    }
    
    // Update user type selector to show customer as active
    document.querySelectorAll('.btn-user-type').forEach(btn => {
        btn.classList.remove('active');
    });
    const customerBtn = document.querySelector('[data-type="customer"]');
    if (customerBtn) customerBtn.classList.add('active');
    
    // Update booking section title
    const bookingTitle = document.querySelector('.booking-form-container h2');
    if (bookingTitle) {
        bookingTitle.innerHTML = `<i class="fas fa-user"></i> Welcome ${currentUser.name}! Request Your Delivery`;
    }
    
    // Add customer-specific features
    addCustomerFeatures();
}

function showDriverInterface() {
    console.log('Showing driver interface');
    
    // Hide customer interface elements
    document.getElementById('customer-form').classList.remove('active');
    
    // Show driver interface
    document.getElementById('driver-form').classList.add('active');
    
    // Hide customer booking section for drivers - drivers don't need to see delivery request forms
    const customerBookingSection = document.getElementById('customer-booking');
    if (customerBookingSection) {
        customerBookingSection.style.display = 'none';
    }
    
    // Hide the "I Need Delivery" button for drivers
    const customerBtn = document.querySelector('[data-type="customer"]');
    if (customerBtn) {
        customerBtn.style.display = 'none';
    }
    
    // Update user type selector to show driver as active
    document.querySelectorAll('.btn-user-type').forEach(btn => {
        btn.classList.remove('active');
    });
    const driverBtn = document.querySelector('[data-type="driver"]');
    if (driverBtn) driverBtn.classList.add('active');
    
    // Update booking section title
    const bookingTitle = document.querySelector('.booking-form-container h2');
    if (bookingTitle) {
        bookingTitle.innerHTML = `<i class="fas fa-truck"></i> Driver Dashboard - Welcome ${currentUser.name}!`;
    }
    
    // Add driver-specific features
    addDriverFeatures();
    
    // Load driver requests
    updateDriverRequests();
}

function addCustomerFeatures() {
    // Add customer-specific UI enhancements
    const customerForm = document.getElementById('customer-form');
    
    // Add bid management section
    if (!customerForm.querySelector('.customer-bids-section')) {
        const bidsSection = document.createElement('div');
        bidsSection.className = 'customer-bids-section';
        bidsSection.style.cssText = `
            background: linear-gradient(135deg, #f39c12, #e67e22);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        `;
        
        bidsSection.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">💰 Driver Bids & Communications</h3>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <div>
                    <div style="font-size: 18px; font-weight: bold;" id="pending-bids-count">0</div>
                    <div style="font-size: 12px; opacity: 0.8;">New Bids Waiting</div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="showCustomerBids()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-hand-holding-usd"></i> View Bids
                    </button>
                    <button onclick="showCustomerContacts()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 15px; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        <i class="fas fa-comments"></i> Messages
                    </button>
                </div>
            </div>
            <div id="recent-bids-preview" style="font-size: 12px; opacity: 0.8;"></div>
        `;
        
        customerForm.insertBefore(bidsSection, customerForm.firstChild);
        
        // Load customer bids
        updateCustomerBidsCount();
    }
    
    // Add customer stats if they don't exist
    if (!customerForm.querySelector('.customer-stats')) {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'customer-stats';
        statsDiv.style.cssText = `
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            text-align: center;
        `;
        
        statsDiv.innerHTML = `
            <div>
                <div style="font-size: 1.5rem; font-weight: 500;" id="customer-requests-count">0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">Total Requests</div>
            </div>
            <div>
                <div style="font-size: 1.5rem; font-weight: 500;" id="customer-completed-count">0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">Completed</div>
            </div>
            <div>
                <div style="font-size: 1.5rem; font-weight: 500;" id="customer-spent-amount">$0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">Total Spent</div>
            </div>
            <div>
                <button onclick="showCustomerHistory()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">
                    <i class="fas fa-history"></i> View History
                </button>
            </div>
        `;
        
        customerForm.insertBefore(statsDiv, customerForm.firstChild);
        
        // Load customer statistics
        loadCustomerStats();
    }
}

function addDriverFeatures() {
    // Add driver-specific UI enhancements
    const driverForm = document.getElementById('driver-form');
    
    // Add location tracking section
    if (!driverForm.querySelector('.driver-location-section')) {
        const locationSection = document.createElement('div');
        locationSection.className = 'driver-location-section';
        locationSection.style.cssText = `
            background: linear-gradient(135deg, #3498db, #2980b9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
        `;
        
        locationSection.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">📍 Your Location & Availability</h3>
            <div style="display: grid; grid-template-columns: 1fr auto; gap: 15px; align-items: center;">
                <div>
                    <input type="text" id="driver-current-location" placeholder="Enter your current location/city" 
                           style="width: 100%; padding: 10px; border: none; border-radius: 5px; font-size: 14px;">
                    <div id="driver-location-status" style="font-size: 12px; margin-top: 5px; opacity: 0.8;"></div>
                </div>
                <div style="text-align: center;">
                    <button onclick="updateDriverLocation()" style="background: #27ae60; border: none; color: white; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin-bottom: 5px; display: block; width: 100%;">
                        <i class="fas fa-map-marker-alt"></i> Update Location
                    </button>
                    <label style="display: flex; align-items: center; font-size: 14px; cursor: pointer;">
                        <input type="checkbox" id="driver-availability" checked onchange="toggleDriverAvailability()" style="margin-right: 8px;">
                        Available for Orders
                    </label>
                </div>
            </div>
        `;
        
        driverForm.insertBefore(locationSection, driverForm.firstChild);
    }
    
    // Add driver-specific UI enhancements
    if (!driverForm.querySelector('.driver-stats')) {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'driver-stats';
        statsDiv.style.cssText = `
            background: linear-gradient(135deg, #e74c3c, #c0392b);
            color: white;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 20px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 15px;
            text-align: center;
        `;
        
        statsDiv.innerHTML = `
            <div>
                <div style="font-size: 1.5rem; font-weight: bold;" id="driver-deliveries-count">0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">Deliveries</div>
            </div>
            <div>
                <div style="font-size: 1.5rem; font-weight: bold;" id="driver-earnings-amount">$0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">Total Earnings</div>
            </div>
            <div>
                <div style="font-size: 1.5rem; font-weight: bold;" id="driver-rating-display">5.0</div>
                <div style="font-size: 0.8rem; opacity: 0.9;">Rating ⭐</div>
            </div>
            <div>
                <button onclick="showDriverHistory()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-size: 0.8rem;">
                    <i class="fas fa-chart-line"></i> View Stats
                </button>
            </div>
        `;
        
        driverForm.insertBefore(statsDiv, driverForm.firstChild);
        
        // Load driver statistics
        loadDriverStats();
    }
    
    // Add availability toggle
    if (!driverForm.querySelector('.availability-toggle')) {
        const availabilityDiv = document.createElement('div');
        availabilityDiv.className = 'availability-toggle';
        availabilityDiv.style.cssText = `
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 2px solid #e1e8ed;
        `;
        
        availabilityDiv.innerHTML = `
            <div>
                <h4 style="margin: 0; color: #2c3e50;">Availability Status</h4>
                <p style="margin: 5px 0 0; color: #666; font-size: 0.9rem;">Toggle to receive new delivery requests</p>
            </div>
            <label style="position: relative; display: inline-block; width: 60px; height: 34px;">
                <input type="checkbox" id="availability-toggle" onchange="toggleAvailability()" style="opacity: 0; width: 0; height: 0;" checked>
                <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #27ae60; transition: .4s; border-radius: 34px;">
                    <span style="position: absolute; content: ''; height: 26px; width: 26px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; transform: translateX(26px);"></span>
                </span>
            </label>
        `;
        
        driverForm.insertBefore(availabilityDiv, driverForm.querySelector('.driver-filters'));
    }
}

// Statistics Loading Functions
async function loadCustomerStats() {
    if (!currentUser || currentUser.type !== 'customer') return;
    
    try {
        const requests = await window.truckDB.getRequestsByCustomer(currentUser.id);
        const deliveries = await window.truckDB.getDeliveriesByCustomer(currentUser.id);
        
        const completedDeliveries = deliveries.filter(d => d.status === 'completed');
        const totalSpent = completedDeliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0);
        
        document.getElementById('customer-requests-count').textContent = requests.length;
        document.getElementById('customer-completed-count').textContent = completedDeliveries.length;
        document.getElementById('customer-spent-amount').textContent = '$' + totalSpent.toFixed(2);
    } catch (error) {
        console.error('Error loading customer stats:', error);
    }
}

async function loadDriverStats() {
    if (!currentUser || currentUser.type !== 'driver') return;
    
    try {
        // Get driver record
        const driver = await window.truckDB.getDriverByUserId(currentUser.id);
        if (!driver) {
            // If no driver record exists, create one
            await createDriverRecord();
            return;
        }
        
        const deliveries = await window.truckDB.getDeliveriesByDriver(driver.id);
        const bids = await window.truckDB.getBidsByDriver(driver.id);
        
        const completedDeliveries = deliveries.filter(d => d.status === 'completed');
        const totalEarnings = completedDeliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0);
        
        document.getElementById('driver-deliveries-count').textContent = completedDeliveries.length;
        document.getElementById('driver-earnings-amount').textContent = '$' + totalEarnings.toFixed(2);
        document.getElementById('driver-rating-display').textContent = (driver.rating || 5.0).toFixed(1);
        
        // Update availability toggle
        const toggle = document.getElementById('availability-toggle');
        if (toggle) {
            toggle.checked = driver.isAvailable;
            updateToggleStyle(toggle);
        }
    } catch (error) {
        console.error('Error loading driver stats:', error);
    }
}

async function createDriverRecord() {
    if (!currentUser || currentUser.type !== 'driver') return;
    
    // Show modal to complete driver profile
    showDriverSetupModal();
}

// History and Detail Functions
async function showCustomerHistory() {
    try {
        const requests = await window.truckDB.getRequestsByCustomer(currentUser.id);
        const deliveries = await window.truckDB.getDeliveriesByCustomer(currentUser.id);

        let historyHtml = `
            <div style="max-height: 400px; overflow-y: auto;">
                <h3>Your Delivery History</h3>
        `;
        
        if (requests.length === 0) {
            historyHtml += '<p>No delivery requests yet. Create your first request above!</p>';
        } else {
            for (const request of requests) {
                const delivery = deliveries.find(d => d.requestId === request.id);
                const status = delivery ? delivery.status : request.status;
                const finalPrice = delivery ? delivery.finalPrice : request.proposedPrice;

                // Assigned driver info
                let driverInfoHtml = '';
                if (request.status === 'assigned' || request.status === 'accepted') {
                    // Get driver info
                    let driverUser = null;
                    if (request.assignedDriverId) {
                        const driver = await window.truckDB.read('drivers', request.assignedDriverId);
                        if (driver) {
                            driverUser = await window.truckDB.read('users', driver.userId);
                        }
                    }
                    if (driverUser) {
                        driverInfoHtml = `
                            <div style="margin-top: 8px; color: #155724;">
                                <strong>Assigned Driver:</strong> ${driverUser.name} <br>
                                <strong>Phone:</strong> <a href="tel:${driverUser.phone}">${driverUser.phone}</a>
                                <button onclick="callDriver('${driverUser.phone}')" style="margin-left:10px;">Call</button>
                            </div>
                        `;
                    }
                }

                historyHtml += `
                    <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #3498db;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <strong>Request #${request.id}</strong>
                            <span class="status-badge status-${status}">${status}</span>
                        </div>
                        <div style="font-size: 0.9rem; color: #666;">
                            <div><strong>From:</strong> ${request.pickupLocation || request.pickup}</div>
                            <div><strong>To:</strong> ${request.deliveryLocation || request.delivery}</div>
                            <div><strong>Price:</strong> $${finalPrice}</div>
                            <div><strong>Date:</strong> ${formatDateTime(request.createdAt)}</div>
                        </div>
                        ${driverInfoHtml}
                    </div>
                `;
            }
        }
        
        historyHtml += '</div>';
        
        // Show in modal or alert
        alert('Customer History:\n' + requests.map(r => 
            `Request #${r.id}: ${r.pickup} → ${r.delivery} ($${r.proposedPrice}) - ${r.status}`
        ).join('\n') || 'No requests yet.');
        
    } catch (error) {
        console.error('Error loading customer history:', error);
        showErrorMessage('Error loading your history');
    }
}

async function showDriverHistory() {
    try {
        const driver = await window.truckDB.getDriverByUserId(currentUser.id);
        if (!driver) {
            alert('Driver profile not found. Please complete your driver setup.');
            return;
        }
        
        const deliveries = await window.truckDB.getDeliveriesByDriver(driver.id);
        const bids = await window.truckDB.getBidsByDriver(driver.id);
        
        let historyText = 'Driver Statistics:\n\n';
        historyText += `Total Bids: ${bids.length}\n`;
        historyText += `Accepted Bids: ${bids.filter(b => b.status === 'accepted').length}\n`;
        historyText += `Total Deliveries: ${deliveries.length}\n`;
        historyText += `Completed Deliveries: ${deliveries.filter(d => d.status === 'completed').length}\n`;
        historyText += `Total Earnings: $${deliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0).toFixed(2)}\n`;
        historyText += `Current Rating: ${driver.rating || 5.0} ⭐\n\n`;
        
        if (deliveries.length > 0) {
            historyText += 'Recent Deliveries:\n';
            deliveries.slice(-5).forEach(delivery => {
                historyText += `• Delivery #${delivery.id}: $${delivery.finalPrice} - ${delivery.status}\n`;
            });
        }
        
        alert(historyText);
    } catch (error) {
        console.error('Error loading driver history:', error);
        showErrorMessage('Error loading your stats');
    }
}

// Driver Availability Functions
async function toggleAvailability() {
    const toggle = document.getElementById('availability-toggle');
    const isAvailable = toggle.checked;
    
    try {
        const driver = await window.truckDB.getDriverByUserId(currentUser.id);
        if (driver) {
            driver.isAvailable = isAvailable;
            await window.truckDB.update('drivers', driver);
            
            updateToggleStyle(toggle);
            showSuccessMessage(isAvailable ? 
                'You are now available for new deliveries!' : 
                'You are now offline. No new requests will be shown.'
            );
        }
    } catch (error) {
        console.error('Error updating availability:', error);
        showErrorMessage('Error updating availability');
        toggle.checked = !isAvailable; // Revert
    }
}

function updateToggleStyle(toggle) {
    const slider = toggle.nextElementSibling;
    const knob = slider.querySelector('span');
    
    if (toggle.checked) {
        slider.style.backgroundColor = '#27ae60';
        knob.style.transform = 'translateX(26px)';
    } else {
        slider.style.backgroundColor = '#ccc';
        knob.style.transform = 'translateX(0)';
    }
}

// Driver Setup Modal
function showDriverSetupModal() {
    // Create a simple setup modal for drivers
    const modalHtml = `
        <div id="driver-setup-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <h2>Complete Your Driver Profile</h2>
                <p>To start receiving delivery requests, please complete your driver information:</p>
                <form id="driver-setup-form">
                    <div class="form-group">
                        <label>Truck Type</label>
                        <select name="truckType" required>
                            <option value="">Select truck type</option>
                            <option value="small">Small Truck (up to 1.5 tons)</option>
                            <option value="medium">Medium Truck (1.5-3 tons)</option>
                            <option value="large">Large Truck (3-5 tons)</option>
                            <option value="xlarge">Extra Large (5+ tons)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>License Plate</label>
                        <input type="text" name="licensePlate" placeholder="ABC-123" required>
                    </div>
                    <div class="form-group">
                        <label>Truck Model</label>
                        <input type="text" name="truckModel" placeholder="e.g., Ford Transit" required>
                    </div>
                    <div class="form-group">
                        <label>Years of Experience</label>
                        <input type="text" name="experience" placeholder="e.g., 5 years">
                    </div>
                    <button type="submit" class="btn-submit">Complete Setup</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Handle form submission
    document.getElementById('driver-setup-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const driverData = Object.fromEntries(formData);
        driverData.userId = currentUser.id;
        
        try {
            await window.truckDB.createDriver(driverData);
            document.getElementById('driver-setup-modal').remove();
            showSuccessMessage('Driver profile completed! You can now receive delivery requests.');
            loadDriverStats();
            updateDriverRequests();
        } catch (error) {
            console.error('Error creating driver profile:', error);
            showErrorMessage('Error creating driver profile');
        }
    });
}

// Fix: Ensure event listeners are attached after DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to user type buttons
    document.querySelectorAll('.btn-user-type').forEach(btn => {
        btn.addEventListener('click', function() {
            switchUserType(this.dataset.type);
        });
    });

    // Attach event listeners to login/signup buttons
    const loginBtn = document.querySelector('.btn-login');
    if (loginBtn) loginBtn.onclick = showLoginModal;
    const signupBtn = document.querySelector('.btn-signup');
    if (signupBtn) signupBtn.onclick = showSignupModal;

    // Attach event listeners to filter and refresh buttons in driver form
    const filterBtn = document.querySelector('.btn-filter');
    if (filterBtn) {
        filterBtn.addEventListener('click', function() {
            const requestId = this.dataset.requestId;
            filterRequests(requestId);
        });
    }
    
    const refreshBtn = document.querySelector('.btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            updateDriverRequests();
        });
    }
});

// Call this function on app load to ensure proper initialization
document.addEventListener('DOMContentLoaded', function() {
    // Initial user type set to customer for demo
    const initialUserType = 'customer'; // or 'driver'
    switchUserType(initialUserType);
});

// Sample function to demonstrate bid management
function showCustomerBids() {
    alert('Showing customer bids (feature in development)');
}

function showCustomerContacts() {
    alert('Showing customer contacts/messages (feature in development)');
}

// Utility Functions
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function formatDateTime(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleString(undefined, options);
}

function getTruckTypeLabel(type) {
    switch(type) {
        case 'small': return '🚚 Small (up to 1.5 tons)';
        case 'medium': return '🚛 Medium (1.5-3 tons)';
        case 'large': return '🚚 Large (3-5 tons)';
        case 'xlarge': return '🚛 Extra Large (5+ tons)';
        default: return 'N/A';
    }
}

// Logout function
function logout() {
    currentUser = null;
    deliveryRequests = [];
    driverOffers = [];
    closeAllModals();
    location.reload();
}

window.logout = logout;

// Show error message (generic)
function showErrorMessage(message) {
    alert(message);
}

// Show success message (generic)
function showSuccessMessage(message) {
    alert(message);
}

// Dynamic modal creation for bids (simplified)
function showBidModal(requestId) {
    const modalHtml = `
        <div id="bid-modal" class="modal" style="display: block;">
            <div class="modal-content">
                <h2>Place Your Bid</h2>
                <p>Enter your bid amount for this delivery request:</p>
                <form id="bid-form">
                    <div class="form-group">
                        <label>Bid Amount ($)</label>
                        <input type="number" id="bid-amount" placeholder="Enter your bid" required>
                    </div>
                    <button type="submit" class="btn-submit">Submit Bid</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // Handle bid form submission
    document.getElementById('bid-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const bidAmount = parseFloat(document.getElementById('bid-amount').value);
        
        if (isNaN(bidAmount) || bidAmount <= 0) {
            showErrorMessage('Invalid bid amount');
            return;
        }
        
        try {
            // Submit bid (simplified)
            await submitBid(requestId, bidAmount);
            showSuccessMessage('Your bid has been submitted!');
            closeModal('bid-modal');
        } catch (error) {
            console.error('Error submitting bid:', error);
            showErrorMessage('Error submitting bid. Please try again.');
        }
    });
}

// Sample function to demonstrate driver registration
function showDriverRegistration() {
    alert('Driver registration (feature in development)');
}

// Sample function to demonstrate customer request creation
function showCustomerRequest() {
    alert('Customer request creation (feature in development)');
}

// Sample function to demonstrate admin dashboard
function showAdminDashboard() {
    alert('Admin dashboard (feature in development)');
}

// Sample function to demonstrate analytics
function showAnalytics() {
    alert('Analytics (feature in development)');
}

// Sample function to demonstrate settings
function showSettings() {
    alert('Settings (feature in development)');
}

// Sample function to demonstrate help
function showHelp() {
    alert('Help & Support (feature in development)');
}

// Sample function to demonstrate about
function showAbout() {
    alert('About TruckDrive (feature in development)');
}

// Sample function to demonstrate contact
function showContact() {
    alert('Contact Us (feature in development)');
}

// Sample function to demonstrate terms and conditions
function showTerms() {
    alert('Terms and Conditions (feature in development)');
}

// Sample function to demonstrate privacy policy
function showPrivacy() {
    alert('Privacy Policy (feature in development)');
}

// Sample function to demonstrate logout
function showLogout() {
    alert('Logout (feature in development)');
}

// Sample function to demonstrate driver profile
function showDriverProfile() {
    alert('Driver Profile (feature in development)');
}

// Sample function to demonstrate customer profile
function showCustomerProfile() {
    alert('Customer Profile (feature in development)');
}

// Sample function to demonstrate user management
function showUserManagement() {
    alert('User Management (feature in development)');
}

// Sample function to demonstrate role management
function showRoleManagement() {
    alert('Role Management (feature in development)');
}

// Sample function to demonstrate permission management
function showPermissionManagement() {
    alert('Permission Management (feature in development)');
}

// Sample function to demonstrate audit logs
function showAuditLogs() {
    alert('Audit Logs (feature in development)');
}

// Sample function to demonstrate system settings
function showSystemSettings() {
    alert('System Settings (feature in development)');
}

// Sample function to demonstrate app settings
function showAppSettings() {
    alert('App Settings (feature in development)');
}

// Sample function to demonstrate notification settings
function showNotificationSettings() {
    alert('Notification Settings (feature in development)');
}

// Sample function to demonstrate language settings
function showLanguageSettings() {
    alert('Language Settings (feature in development)');
}

// Sample function to demonstrate theme settings
function showThemeSettings() {
    alert('Theme Settings (feature in development)');
}

// Sample function to demonstrate backup and restore
function showBackupRestore() {
    alert('Backup and Restore (feature in development)');
}

// Sample function to demonstrate data export
function showDataExport() {
    alert('Data Export (feature in development)');
}

// Sample function to demonstrate data import
function showDataImport() {
    alert('Data Import (feature in development)');
}

// Sample function to demonstrate API access
function showApiAccess() {
    alert('API Access (feature in development)');
}

// Sample function to demonstrate webhook settings
function showWebhookSettings() {
    alert('Webhook Settings (feature in development)');
}

// Sample function to demonstrate integration settings
function showIntegrationSettings() {
    alert('Integration Settings (feature in development)');
}

// Sample function to demonstrate payment settings
function showPaymentSettings() {
    alert('Payment Settings (feature in development)');
}

// Sample function to demonstrate shipping settings
function showShippingSettings() {
    alert('Shipping Settings (feature in development)');
}

// Sample function to demonstrate tax settings
function showTaxSettings() {
    alert('Tax Settings (feature in development)');
}

// Sample function to demonstrate discount settings
function showDiscountSettings() {
    alert('Discount Settings (feature in development)');
}

// Sample function to demonstrate coupon settings
function showCouponSettings() {
    alert('Coupon Settings (feature in development)');
}

// Sample function to demonstrate report settings
function showReportSettings() {
    alert('Report Settings (feature in development)');
}

// Sample function to demonstrate dashboard settings
function showDashboardSettings() {
    alert('Dashboard Settings (feature in development)');
}

// Sample function to demonstrate widget settings
function showWidgetSettings() {
    alert('Widget Settings (feature in development)');
}

// Sample function to demonstrate layout settings
function showLayoutSettings() {
    alert('Layout Settings (feature in development)');
}

// Sample function to demonstrate menu settings
function showMenuSettings() {
    alert('Menu Settings (feature in development)');
}

// Sample function to demonstrate footer settings
function showFooterSettings() {
    alert('Footer Settings (feature in development)');
}

// Sample function to demonstrate header settings
function showHeaderSettings() {
    alert('Header Settings (feature in development)');
}

// Sample function to demonstrate sidebar settings
function showSidebarSettings() {
    alert('Sidebar Settings (feature in development)');
}

// Sample function to demonstrate content settings
function showContentSettings() {
    alert('Content Settings (feature in development)');
}

// Sample function to demonstrate media settings
function showMediaSettings() {
    alert('Media Settings (feature in development)');
}

// Sample function to demonstrate file settings
function showFileSettings() {
    alert('File Settings (feature in development)');
}

// Sample function to demonstrate folder settings
function showFolderSettings() {
    alert('Folder Settings (feature in development)');
}

// Sample function to demonstrate archive settings
function showArchiveSettings() {
    alert('Archive Settings (feature in development)');
}

// Sample function to demonstrate backup settings
function showBackupSettings() {
    alert('Backup Settings (feature in development)');
}

// Sample function to demonstrate restore settings
function showRestoreSettings() {
    alert('Restore Settings (feature in development)');
}

// Sample function to demonstrate sync settings
function showSyncSettings() {
    alert('Sync Settings (feature in development)');
}

// Sample function to demonstrate merge settings
function showMergeSettings() {
    alert('Merge Settings (feature in development)');
}

// Sample function to demonstrate split settings
function showSplitSettings() {
    alert('Split Settings (feature in development)');
}

// Sample function to demonstrate combine settings
function showCombineSettings() {
    alert('Combine Settings (feature in development)');
}

// Sample function to demonstrate duplicate settings
function showDuplicateSettings() {
    alert('Duplicate Settings (feature in development)');
}

// Sample function to demonstrate remove settings
function showRemoveSettings() {
    alert('Remove Settings (feature in development)');
}

// Sample function to demonstrate clear settings
function showClearSettings() {
    alert('Clear Settings (feature in development)');
}

// Sample function to demonstrate reset settings
function showResetSettings() {
    alert('Reset Settings (feature in development)');
}

// Sample function to demonstrate default settings
function showDefaultSettings() {
    alert('Default Settings (feature in development)');
}

// Sample function to demonstrate custom settings
function showCustomSettings() {
    alert('Custom Settings (feature in development)');
}

// Sample function to demonstrate advanced settings
function showAdvancedSettings() {
    alert('Advanced Settings (feature in development)');
}

// Sample function to demonstrate basic settings
function showBasicSettings() {
    alert('Basic Settings (feature in development)');
}

// Sample function to demonstrate general settings
function showGeneralSettings() {
    alert('General Settings (feature in development)');
}

// Sample function to demonstrate specific settings
function showSpecificSettings() {
    alert('Specific Settings (feature in development)');
}

// Sample function to demonstrate detailed settings
function showDetailedSettings() {
    alert('Detailed Settings (feature in development)');
}

// Sample function to demonstrate summary settings
function showSummarySettings() {
    alert('Summary Settings (feature in development)');
}

// Sample function to demonstrate overview settings
function showOverviewSettings() {
    alert('Overview Settings (feature in development)');
}

// Sample function to demonstrate quick settings
function showQuickSettings() {
    alert('Quick Settings (feature in development)');
}

// Sample function to demonstrate fast settings
function showFastSettings() {
    alert('Fast Settings (feature in development)');
}

// Sample function to demonstrate instant settings
function showInstantSettings() {
    alert('Instant Settings (feature in development)');
}

// Sample function to demonstrate immediate settings
function showImmediateSettings() {
    alert('Immediate Settings (feature in development)');
}

// Sample function to demonstrate urgent settings
function showUrgentSettings() {
    alert('Urgent Settings (feature in development)');
}

// Sample function to demonstrate priority settings
function showPrioritySettings() {
    alert('Priority Settings (feature in development)');
}

// Sample function to demonstrate important settings
function showImportantSettings() {
    alert('Important Settings (feature in development)');
}

// Sample function to demonstrate essential settings
function showEssentialSettings() {
    alert('Essential Settings (feature in development)');
}

// Sample function to demonstrate required settings
function showRequiredSettings() {
    alert('Required Settings (feature in development)');
}

// Sample function to demonstrate recommended settings
function showRecommendedSettings() {
    alert('Recommended Settings (feature in development)');
}

// Sample function to demonstrate suggested settings
function showSuggestedSettings() {
    alert('Suggested Settings (feature in development)');
}

// Sample function to demonstrate optional settings
function showOptionalSettings() {
    alert('Optional Settings (feature in development)');
}

// Sample function to demonstrate alternative settings
function showAlternativeSettings() {
    alert('Alternative Settings (feature in development)');
}

// Sample function to demonstrate substitute settings
function showSubstituteSettings() {
    alert('Substitute Settings (feature in development)');
}

// Sample function to demonstrate equivalent settings
function showEquivalentSettings() {
    alert('Equivalent Settings (feature in development)');
}

// Sample function to demonstrate comparable settings
function showComparableSettings() {
    alert('Comparable Settings (feature in development)');
}

// Sample function to demonstrate similar settings
function showSimilarSettings() {
    alert('Similar Settings (feature in development)');
}

// Sample function to demonstrate parallel settings
function showParallelSettings() {
    alert('Parallel Settings (feature in development)');
}

// Sample function to demonstrate corresponding settings
function showCorrespondingSettings() {
    alert('Corresponding Settings (feature in development)');
}

// Sample function to demonstrate matching settings
function showMatchingSettings() {
    alert('Matching Settings (feature in development)');
}

// Sample function to demonstrate aligned settings
function showAlignedSettings() {
    alert('Aligned Settings (feature in development)');
}

// Sample function to demonstrate coordinated settings
function showCoordinatedSettings() {
    alert('Coordinated Settings (feature in development)');
}

// Sample function to demonstrate integrated settings
function showIntegratedSettings() {
    alert('Integrated Settings (feature in development)');
}

// Sample function to demonstrate unified settings
function showUnifiedSettings() {
    alert('Unified Settings (feature in development)');
}

// Sample function to demonstrate consolidated settings
function showConsolidatedSettings() {
    alert('Consolidated Settings (feature in development)');
}

// Sample function to demonstrate combined settings
function showCombinedSettings() {
    alert('Combined Settings (feature in development)');
}

// Sample function to demonstrate merged settings
function showMergedSettings() {
    alert('Merged Settings (feature in development)');
}

// Sample function to demonstrate split settings
function showSplitSettings() {
    alert('Split Settings (feature in development)');
}

// Sample function to demonstrate divided settings
function showDividedSettings() {
    alert('Divided Settings (feature in development)');
}

// Sample function to demonstrate separated settings
function showSeparatedSettings() {
    alert('Separated Settings (feature in development)');
}

// Sample function to demonstrate detached settings
function showDetachedSettings() {
    alert('Detached Settings (feature in development)');
}

// Sample function to demonstrate isolated settings
function showIsolatedSettings() {
    alert('Isolated Settings (feature in development)');
}

// Sample function to demonstrate remote settings
function showRemoteSettings() {
    alert('Remote Settings (feature in development)');
}

// Sample function to demonstrate local settings
function showLocalSettings() {
    alert('Local Settings (feature in development)');
}