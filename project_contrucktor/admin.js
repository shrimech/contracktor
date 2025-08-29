// Admin Panel JavaScript for TruckDrive Database Management
console.log('Admin.js v5.0 loaded - FIXED: Disabled auto-creation of john@example.com, ahmed@example.com, sarah@example.com');

let currentPage = 1;
let itemsPerPage = 10;
let currentData = [];
let filteredData = [];

// Initialize Admin Panel
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin panel loading...');
    
    // Wait for database to be ready
    await waitForDatabase();
    console.log('Database is ready, checking connection...');
    
    // Test database connection
    try {
        const testUsers = await window.truckDB.read('users');
        console.log('Database test successful. Users found:', testUsers.length);
    } catch (error) {
        console.error('Database test failed:', error);
        showAlert('Database connection failed: ' + error.message, 'error');
        return;
    }
    
    // Load initial data
    await refreshStats();
    loadCustomers();
    loadOverview();
    
    // Setup form handlers
    setupFormHandlers();
    
    console.log('Admin panel loaded successfully');
});

// Test Data Functions
async function createTestData() {
    if (!confirm('This will create sample users and data for testing the driver experience. Continue?')) return;
    
    try {
        console.log('Creating test data for driver testing...');
        
        // Create test customers who need deliveries
        const customer1 = await window.truckDB.createUser({
            name: 'John Smith',
            email: 'john@customer.com',
            phone: '+1234567890',
            password: 'password123',
            type: 'customer'
        });
        
        const customer2 = await window.truckDB.createUser({
            name: 'Maria Garcia',
            email: 'maria@customer.com',
            phone: '+1234567891',
            password: 'password123',
            type: 'customer'
        });
        
        // Create delivery requests that drivers can accept
        const request1 = await window.truckDB.createDeliveryRequest({
            customerId: customer1.id,
            pickup: 'New York, NY - 123 Main St',
            delivery: 'Boston, MA - 456 Oak Ave',
            items: 'Furniture set (sofa, table, chairs)',
            weight: '500 lbs',
            truckType: 'medium',
            proposedPrice: 280,
            date: new Date().toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        const request2 = await window.truckDB.createDeliveryRequest({
            customerId: customer2.id,
            pickup: 'Los Angeles, CA - 789 Pine St',
            delivery: 'San Diego, CA - 321 Elm Rd',
            items: 'Electronics and appliances (TV, fridge, washer)',
            weight: '800 lbs',
            truckType: 'large',
            proposedPrice: 350,
            date: new Date().toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        const request3 = await window.truckDB.createDeliveryRequest({
            customerId: customer1.id,
            pickup: 'Chicago, IL - 555 Lake Dr',
            delivery: 'Milwaukee, WI - 888 River St',
            items: 'Office supplies and small furniture',
            weight: '300 lbs',
            truckType: 'small',
            proposedPrice: 150,
            date: new Date().toISOString(),
            status: 'pending',
            createdAt: new Date().toISOString()
        });
        
        console.log('Test data created successfully');
        showAlert('Driver test scenario created! Now you can:\n\n1. Register as a driver on the main app\n2. Complete your driver profile\n3. See available delivery requests\n4. Place bids or accept requests\n\nRefreshing to show new data...', 'success');
        
        // Refresh the data
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        
    } catch (error) {
        console.error('Error creating test data:', error);
        showAlert('Error creating test data: ' + error.message, 'error');
    }
}

async function clearAllData() {
    if (!confirm('This will DELETE ALL DATA from the database. Are you absolutely sure?')) return;
    if (!confirm('Last warning: This action cannot be undone. All users (including john@example.com, sarah@example.com, ahmed@example.com and ALL other users), drivers, customers, requests, and deliveries will be permanently deleted. Proceed?')) return;
    
    try {
        console.log('Starting complete data clearing process...');
        showAlert('Clearing all data from both IndexedDB and localStorage...', 'info');
        
        // First, let's see what data exists before clearing
        console.log('=== DATA BEFORE CLEARING ===');
        const beforeUsers = await window.truckDB.read('users') || [];
        console.log('Users before clearing:', beforeUsers.map(u => ({ id: u.id, name: u.name, email: u.email, type: u.type })));
        
        // Use the enhanced clearAllData method from the database
        await window.truckDB.clearAllData();
        
        // Reinitialize the database without auto-loading initial data
        console.log('Reinitializing database...');
        await window.truckDB.init();
        
        // Additional cleanup - clear any session storage as well
        try {
            sessionStorage.clear();
            console.log('SessionStorage cleared');
        } catch (e) {
            console.log('SessionStorage clear failed:', e);
        }
        
        // Clear any cached user session
        if (window.currentUser) {
            window.currentUser = null;
            console.log('Current user session cleared');
        }
        
        // Verify data is actually cleared
        console.log('=== VERIFYING DATA CLEARING ===');
        const afterUsers = await window.truckDB.read('users') || [];
        console.log('Users after clearing:', afterUsers.length === 0 ? 'SUCCESSFULLY CLEARED' : `WARNING: ${afterUsers.length} users still exist!`);
        
        if (afterUsers.length > 0) {
            console.log('Remaining users:', afterUsers.map(u => ({ id: u.id, name: u.name, email: u.email, type: u.type })));
            showAlert('Warning: Some users may still exist. Check console for details.', 'warning');
        }
        
        console.log('All data clearing process completed');
        showAlert('All data cleared successfully! All users including test users (john@example.com, sarah@example.com, etc.) have been permanently deleted. Refreshing view...', 'success');
        
        // Clear the UI immediately
        clearAllTables();
        
        // Refresh the page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 3000);
        
    } catch (error) {
        console.error('Error clearing data:', error);
        showAlert('Error clearing data: ' + error.message, 'error');
    }
}

// Clear only fake/test drivers while keeping real users
async function clearTestDataOnly() {
    if (!confirm('This will remove only fake drivers (john@example.com, ahmed@example.com, sarah@example.com) while keeping your real accounts. Continue?')) return;
    
    try {
        console.log('Starting fake drivers removal...');
        showAlert('Removing fake drivers only...', 'info');
        
        // Get all users and drivers
        const allUsers = await window.truckDB.read('users') || [];
        const allDrivers = await window.truckDB.read('drivers') || [];
        
        // Identify fake users by email
        const fakeEmails = ['john@example.com', 'ahmed@example.com', 'sarah@example.com'];
        const fakeUsers = allUsers.filter(user => fakeEmails.includes(user.email));
        const fakeUserIds = fakeUsers.map(user => user.id);
        
        console.log('Found fake users:', fakeUsers.map(u => ({ id: u.id, name: u.name, email: u.email })));
        
        // Remove fake drivers
        const fakeDrivers = allDrivers.filter(driver => fakeUserIds.includes(driver.userId));
        for (const driver of fakeDrivers) {
            await window.truckDB.delete('drivers', driver.id);
            console.log('Deleted fake driver:', driver);
        }
        
        // Remove fake users
        for (const user of fakeUsers) {
            await window.truckDB.delete('users', user.id);
            console.log('Deleted fake user:', user.email);
        }
        
        // Remove any delivery requests from fake users
        const allRequests = await window.truckDB.read('deliveryRequests') || [];
        const fakeRequests = allRequests.filter(request => fakeUserIds.includes(request.customerId));
        for (const request of fakeRequests) {
            await window.truckDB.delete('deliveryRequests', request.id);
            console.log('Deleted fake request:', request.id);
        }
        
        // Remove any bids from fake drivers
        const allBids = await window.truckDB.read('bids') || [];
        const fakeBids = allBids.filter(bid => fakeUserIds.includes(bid.driverId));
        for (const bid of fakeBids) {
            await window.truckDB.delete('bids', bid.id);
            console.log('Deleted fake bid:', bid.id);
        }
        
        showAlert(`Successfully removed ${fakeUsers.length} fake users, ${fakeDrivers.length} fake drivers, ${fakeRequests.length} fake requests, and ${fakeBids.length} fake bids. Your real accounts are preserved.`, 'success');
        
        // Refresh the data display
        refreshAllData();
        
    } catch (error) {
        console.error('Error removing fake data:', error);
        showAlert('Error removing fake data: ' + error.message, 'error');
    }
}

// Clear all table displays immediately
function clearAllTables() {
    // Clear customers table
    const customersTable = document.querySelector('#customers-table tbody');
    if (customersTable) {
        customersTable.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No customers found. All data has been cleared.</td></tr>';
    }
    
    // Clear drivers table
    const driversTable = document.querySelector('#drivers-table tbody');
    if (driversTable) {
        driversTable.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No drivers found. All data has been cleared.</td></tr>';
    }
    
    // Clear requests table
    const requestsTable = document.querySelector('#requests-table tbody');
    if (requestsTable) {
        requestsTable.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No requests found. All data has been cleared.</td></tr>';
    }
    
    // Clear bids table
    const bidsTable = document.querySelector('#bids-table tbody');
    if (bidsTable) {
        bidsTable.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No bids found. All data has been cleared.</td></tr>';
    }
    
    // Clear deliveries table
    const deliveriesTable = document.querySelector('#deliveries-table tbody');
    if (deliveriesTable) {
        deliveriesTable.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">No deliveries found. All data has been cleared.</td></tr>';
    }
    
    // Reset statistics to zero
    resetStatistics();
}

// Reset statistics to zero
function resetStatistics() {
    const statsGrid = document.getElementById('stats-grid');
    if (statsGrid) {
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Total Users</div>
                <div class="stat-sublabel">All data cleared</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Customers</div>
                <div class="stat-sublabel">All data cleared</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Active Drivers</div>
                <div class="stat-sublabel">All data cleared</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Delivery Requests</div>
                <div class="stat-sublabel">All data cleared</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">0</div>
                <div class="stat-label">Completed Deliveries</div>
                <div class="stat-sublabel">All data cleared</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">$0.00</div>
                <div class="stat-label">Total Revenue</div>
                <div class="stat-sublabel">All data cleared</div>
            </div>
        `;
    }
}

// Debug function to see exactly what data exists
async function debugDatabase() {
    try {
        console.log('=== DATABASE DEBUG REPORT ===');
        
        const users = await window.truckDB.read('users') || [];
        const drivers = await window.truckDB.read('drivers') || [];
        const requests = await window.truckDB.read('deliveryRequests') || [];
        const deliveries = await window.truckDB.read('deliveries') || [];
        const bids = await window.truckDB.read('bids') || [];
        
        console.log('USERS (', users.length, '):', users.map(u => ({ 
            id: u.id, 
            name: u.name, 
            email: u.email, 
            type: u.type,
            createdAt: u.createdAt
        })));
        
        console.log('DRIVERS (', drivers.length, '):', drivers);
        console.log('REQUESTS (', requests.length, '):', requests);
        console.log('DELIVERIES (', deliveries.length, '):', deliveries);
        console.log('BIDS (', bids.length, '):', bids);
        
        // Check localStorage
        console.log('=== LOCALSTORAGE CHECK ===');
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.includes('truck') || key.includes('user') || key.includes('DB'))) {
                try {
                    const value = localStorage.getItem(key);
                    console.log(`localStorage[${key}]:`, value ? JSON.parse(value) : value);
                } catch (e) {
                    console.log(`localStorage[${key}]:`, localStorage.getItem(key));
                }
            }
        }
        
        console.log('=== END DEBUG REPORT ===');
        
        const report = `
DATABASE DEBUG REPORT:
- Users: ${users.length} (${users.map(u => u.email).join(', ')})
- Drivers: ${drivers.length}
- Requests: ${requests.length}
- Deliveries: ${deliveries.length}
- Bids: ${bids.length}

Check console for detailed information.
        `;
        
        alert(report);
        
    } catch (error) {
        console.error('Error debugging database:', error);
        alert('Error debugging database: ' + error.message);
    }
}

// Wait for database initialization
function waitForDatabase() {
    return new Promise((resolve) => {
        const checkDB = () => {
            if (window.truckDB && window.truckDB.isReady) {
                resolve();
            } else {
                setTimeout(checkDB, 100);
            }
        };
        checkDB();
    });
}

// Tab Management
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Load tab-specific data
    switch(tabName) {
        case 'overview':
            loadOverview();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'drivers':
            loadDrivers();
            break;
        case 'requests':
            loadRequests();
            break;
        case 'bids':
            loadBids();
            break;
        case 'deliveries':
            loadDeliveries();
            break;
        case 'maintenance':
            loadMaintenanceInfo();
            break;
    }
}

// Statistics Management
async function refreshStats() {
    try {
        console.log('Refreshing statistics...');
        
        // Get all data from database
        const users = await window.truckDB.read('users') || [];
        const drivers = await window.truckDB.read('drivers') || [];
        const requests = await window.truckDB.read('deliveryRequests') || [];
        const deliveries = await window.truckDB.read('deliveries') || [];
        const bids = await window.truckDB.read('bids') || [];
        
        console.log('Raw data:', { 
            users: users.length, 
            drivers: drivers.length, 
            requests: requests.length, 
            deliveries: deliveries.length, 
            bids: bids.length 
        });
        
        // Calculate accurate statistics
        const totalUsers = users.length;
        const customers = users.filter(user => user.type === 'customer');
        const driverUsers = users.filter(user => user.type === 'driver');
        const totalCustomers = customers.length;
        const totalDriverUsers = driverUsers.length;
        const totalDriverProfiles = drivers.length;
        const totalRequests = requests.length;
        const completedDeliveries = deliveries.filter(d => d.status === 'completed');
        const totalRevenue = completedDeliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0);
        
        console.log('Calculated stats:', {
            totalUsers,
            totalCustomers,
            totalDriverUsers,
            totalDriverProfiles,
            totalRequests,
            completedDeliveries: completedDeliveries.length,
            totalRevenue
        });
        
        // Update statistics display
        const statsGrid = document.getElementById('stats-grid');
        if (statsGrid) {
            statsGrid.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${totalUsers}</div>
                    <div class="stat-label">Total Users</div>
                    <div class="stat-sublabel">${totalCustomers} customers, ${totalDriverUsers} drivers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalCustomers}</div>
                    <div class="stat-label">Customers</div>
                    <div class="stat-sublabel">Registered customers</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalDriverProfiles}</div>
                    <div class="stat-label">Active Drivers</div>
                    <div class="stat-sublabel">${totalDriverUsers} driver accounts</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${totalRequests}</div>
                    <div class="stat-label">Delivery Requests</div>
                    <div class="stat-sublabel">Total requests made</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${completedDeliveries.length}</div>
                    <div class="stat-label">Completed Deliveries</div>
                    <div class="stat-sublabel">Successfully completed</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">$${totalRevenue.toFixed(2)}</div>
                    <div class="stat-label">Total Revenue</div>
                    <div class="stat-sublabel">Platform earnings</div>
                </div>
            `;
        }
        
        console.log('Statistics updated successfully');
    } catch (error) {
        console.error('Error refreshing statistics:', error);
        showAlert('Error refreshing statistics', 'error');
    }
}

// Overview Tab
async function loadOverview() {
    try {
        const users = await window.truckDB.read('users');
        const requests = await window.truckDB.read('deliveryRequests');
        const deliveries = await window.truckDB.read('deliveries');
        
        const overviewCharts = document.getElementById('overview-charts');
        
        // Calculate stats
        const customerCount = users.filter(u => u.type === 'customer').length;
        const driverCount = users.filter(u => u.type === 'driver').length;
        const pendingRequests = requests.filter(r => r.status === 'pending').length;
        const completedDeliveries = deliveries.filter(d => d.status === 'completed').length;
        
        overviewCharts.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3>User Distribution</h3>
                    <div style="margin: 20px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Customers</span>
                            <span><strong>${customerCount}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Drivers</span>
                            <span><strong>${driverCount}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Total Users</span>
                            <span><strong>${users.length}</strong></span>
                        </div>
                    </div>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3>Request Status</h3>
                    <div style="margin: 20px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Pending</span>
                            <span><strong>${pendingRequests}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                            <span>Completed</span>
                            <span><strong>${completedDeliveries}</strong></span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Total Requests</span>
                            <span><strong>${requests.length}</strong></span>
                        </div>
                    </div>
                </div>
                
                <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h3>Recent Activity</h3>
                    <div style="margin: 20px 0;">
                        ${getRecentActivity(requests, deliveries)}
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading overview:', error);
    }
}

function getRecentActivity(requests, deliveries) {
    const activities = [];
    
    // Add recent requests
    requests.slice(-3).forEach(request => {
        activities.push({
            type: 'request',
            text: `New delivery request from ${request.customer}`,
            time: request.createdAt
        });
    });
    
    // Add recent deliveries
    deliveries.slice(-3).forEach(delivery => {
        activities.push({
            type: 'delivery',
            text: `Delivery ${delivery.status}`,
            time: delivery.updatedAt || delivery.createdAt
        });
    });
    
    // Sort by time and take recent 5
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    activities.splice(5);
    
    if (activities.length === 0) {
        return '<p style="color: #666; font-style: italic;">No recent activity</p>';
    }
    
    return activities.map(activity => `
        <div style="padding: 8px 0; border-bottom: 1px solid #eee;">
            <div style="font-size: 0.9rem;">${activity.text}</div>
            <div style="font-size: 0.8rem; color: #666;">${formatDateTime(activity.time)}</div>
        </div>
    `).join('');
}

// Customers Management
async function loadCustomers() {
    try {
        console.log('Loading customers...');
        console.log('Database object:', window.truckDB);
        
        const users = await window.truckDB.read('users');
        console.log('All users from database:', users);
        
        const requests = await window.truckDB.read('deliveryRequests');
        console.log('All requests from database:', requests);
        
        const deliveries = await window.truckDB.read('deliveries');
        console.log('All deliveries from database:', deliveries);
        
        // Filter only customers
        const customers = users.filter(user => user.type === 'customer');
        console.log('Filtered customers:', customers);
        
        if (customers.length === 0) {
            console.log('No customers found in database');
            const tbody = document.querySelector('#customers-table tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">No customers found. Users need to register first.</td></tr>';
            }
            return;
        }
        
        // Calculate customer statistics
        const customerStats = customers.map(customer => {
            const customerRequests = requests.filter(r => r.customerId === customer.id);
            const customerDeliveries = deliveries.filter(d => d.customerId === customer.id);
            const totalSpent = customerDeliveries
                .filter(d => d.status === 'completed')
                .reduce((sum, d) => sum + (d.finalPrice || 0), 0);
            
            const lastRequest = customerRequests.length > 0 
                ? customerRequests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
                : null;
            
            return {
                ...customer,
                totalRequests: customerRequests.length,
                totalSpent: totalSpent,
                lastRequestDate: lastRequest ? lastRequest.createdAt : null,
                completedDeliveries: customerDeliveries.filter(d => d.status === 'completed').length
            };
        });
        
        console.log('Customer stats calculated:', customerStats);
        
        currentData = customerStats;
        filteredData = customerStats;
        displayCustomers(customerStats);
        updateCustomerStats(customerStats, requests, deliveries);
        updatePagination('customers');
    } catch (error) {
        console.error('Error loading customers:', error);
        showAlert('Error loading customers: ' + error.message, 'error');
        
        // Show error message in table
        const tbody = document.querySelector('#customers-table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: red;">Error loading customers: ${error.message}</td></tr>`;
        }
    }
}

function displayCustomers(customers) {
    const tbody = document.querySelector('#customers-table tbody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageCustomers = customers.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageCustomers.map(customer => `
        <tr>
            <td>${customer.id}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #3498db; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        ${customer.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 500;">${customer.name}</div>
                        <div style="font-size: 0.8rem; color: #666;">Customer since ${formatDate(customer.createdAt)}</div>
                    </div>
                </div>
            </td>
            <td>${customer.email}</td>
            <td>${customer.phone}</td>
            <td>
                <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">
                    ${customer.totalRequests} requests
                </span>
            </td>
            <td>
                <span style="color: #27ae60; font-weight: bold; font-size: 1.1rem;">
                    $${customer.totalSpent.toFixed(2)}
                </span>
            </td>
            <td>${customer.lastRequestDate ? formatDateTime(customer.lastRequestDate) : 'Never'}</td>
            <td>
                <span class="status-badge ${customer.isActive ? 'status-accepted' : 'status-rejected'}">
                    ${customer.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <button class="action-btn btn-view" onclick="viewCustomerDetails(${customer.id})">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn btn-edit" onclick="editCustomer(${customer.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn btn-delete" onclick="deleteCustomer(${customer.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function updateCustomerStats(customers, requests, deliveries) {
    const totalCustomers = customers.length;
    const activeCustomers = customers.filter(c => c.isActive).length;
    const totalRequests = customers.reduce((sum, c) => sum + c.totalRequests, 0);
    const totalSpending = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    
    document.getElementById('total-customers').textContent = totalCustomers;
    document.getElementById('active-customers').textContent = activeCustomers;
    document.getElementById('customer-requests').textContent = totalRequests;
    document.getElementById('customer-spending').textContent = '$' + totalSpending.toFixed(2);
}

// Delivery Requests Management
async function loadRequests() {
    try {
        const requests = await window.truckDB.read('deliveryRequests');
        currentData = requests;
        filteredData = requests;
        displayRequests(requests);
        updatePagination('requests');
    } catch (error) {
        console.error('Error loading requests:', error);
        showAlert('Error loading delivery requests', 'error');
    }
}

function displayRequests(requests) {
    const tbody = document.querySelector('#requests-table tbody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageRequests = requests.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageRequests.map(request => `
        <tr>
            <td>${request.id}</td>
            <td>${request.customer}</td>
            <td>${truncateText(request.pickup, 30)}</td>
            <td>${truncateText(request.delivery, 30)}</td>
            <td>${request.truckType}</td>
            <td>$${request.proposedPrice}</td>
            <td><span class="status-badge status-${request.status}">${request.status}</span></td>
            <td>${formatDateTime(request.createdAt)}</td>
            <td>
                <button class="action-btn btn-view" onclick="viewRequest(${request.id})">View</button>
                <button class="action-btn btn-edit" onclick="editRequest(${request.id})">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteRequest(${request.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Drivers Management
async function loadDrivers() {
    try {
        console.log('Loading drivers...');
        
        const drivers = await window.truckDB.read('drivers');
        console.log('All drivers from database:', drivers);
        
        const users = await window.truckDB.read('users');
        console.log('All users for drivers:', users);
        
        const deliveries = await window.truckDB.read('deliveries');
        const bids = await window.truckDB.read('bids');
        
        if (drivers.length === 0) {
            console.log('No drivers found in database');
            const tbody = document.querySelector('#drivers-table tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px;">No drivers found. Drivers need to complete registration first.</td></tr>';
            }
            return;
        }
        
        // Combine driver and user data with statistics
        const driversWithStats = drivers.map(driver => {
            const user = users.find(u => u.id === driver.userId);
            const driverDeliveries = deliveries.filter(d => d.driverId === driver.id);
            const driverBids = bids.filter(b => b.driverId === driver.id);
            const totalEarnings = driverDeliveries
                .filter(d => d.status === 'completed')
                .reduce((sum, d) => sum + (d.finalPrice || 0), 0);
            
            return { 
                ...driver, 
                userName: user ? user.name : 'Unknown',
                userEmail: user ? user.email : 'N/A',
                userPhone: user ? user.phone : 'N/A',
                userCreatedAt: user ? user.createdAt : null,
                totalDeliveries: driverDeliveries.length,
                completedDeliveries: driverDeliveries.filter(d => d.status === 'completed').length,
                totalBids: driverBids.length,
                acceptedBids: driverBids.filter(b => b.status === 'accepted').length,
                totalEarnings: totalEarnings,
                averageRating: driver.rating || 5.0
            };
        });
        
        console.log('Drivers with stats:', driversWithStats);
        
        currentData = driversWithStats;
        filteredData = driversWithStats;
        displayDrivers(driversWithStats);
        updateDriverStats(driversWithStats);
        updatePagination('drivers');
    } catch (error) {
        console.error('Error loading drivers:', error);
        showAlert('Error loading drivers: ' + error.message, 'error');
        
        // Show error message in table
        const tbody = document.querySelector('#drivers-table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 20px; color: red;">Error loading drivers: ${error.message}</td></tr>`;
        }
    }
}

function displayDrivers(drivers) {
    const tbody = document.querySelector('#drivers-table tbody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageDrivers = drivers.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageDrivers.map(driver => `
        <tr>
            <td>${driver.id}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background: #e74c3c; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                        ${driver.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div style="font-weight: 500;">${driver.userName}</div>
                        <div style="font-size: 0.8rem; color: #666;">Driver since ${formatDate(driver.userCreatedAt)}</div>
                    </div>
                </div>
            </td>
            <td>${driver.userEmail}</td>
            <td>${driver.userPhone}</td>
            <td>
                <span style="background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;">
                    ${getTruckTypeLabel(driver.truckType)}
                </span>
            </td>
            <td>
                <span style="font-family: monospace; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                    ${driver.licensePlate}
                </span>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="color: #f39c12; font-size: 1.2rem;">★</span>
                    <span style="font-weight: bold;">${driver.averageRating}</span>
                </div>
            </td>
            <td>
                <div style="text-align: center;">
                    <div style="font-weight: bold; color: #27ae60;">${driver.completedDeliveries}</div>
                    <div style="font-size: 0.8rem; color: #666;">of ${driver.totalDeliveries}</div>
                </div>
            </td>
            <td>
                <span style="color: #27ae60; font-weight: bold; font-size: 1.1rem;">
                    $${driver.totalEarnings.toFixed(2)}
                </span>
            </td>
            <td>
                <span class="status-badge ${driver.isAvailable ? 'status-accepted' : 'status-rejected'}">
                    ${driver.isAvailable ? 'Available' : 'Busy'}
                </span>
            </td>
            <td>
                <button class="action-btn btn-view" onclick="viewDriverDetails(${driver.id})">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn btn-edit" onclick="editDriver(${driver.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn btn-delete" onclick="deleteDriver(${driver.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        </tr>
    `).join('');
}

function updateDriverStats(drivers) {
    const totalDrivers = drivers.length;
    const availableDrivers = drivers.filter(d => d.isAvailable).length;
    const totalDeliveries = drivers.reduce((sum, d) => sum + d.completedDeliveries, 0);
    const totalEarnings = drivers.reduce((sum, d) => sum + d.totalEarnings, 0);
    
    document.getElementById('total-drivers').textContent = totalDrivers;
    document.getElementById('available-drivers').textContent = availableDrivers;
    document.getElementById('driver-deliveries').textContent = totalDeliveries;
    document.getElementById('driver-earnings').textContent = '$' + totalEarnings.toFixed(2);
}

function filterDrivers() {
    const statusFilter = document.getElementById('driver-status-filter').value;
    const truckFilter = document.getElementById('driver-truck-filter').value;
    
    filteredData = currentData.filter(driver => {
        const statusMatch = !statusFilter || 
            (statusFilter === 'available' && driver.isAvailable) ||
            (statusFilter === 'busy' && !driver.isAvailable);
        const truckMatch = !truckFilter || driver.truckType === truckFilter;
        return statusMatch && truckMatch;
    });
    
    displayDrivers(filteredData);
}

// Bids Management
async function loadBids() {
    try {
        const bids = await window.truckDB.read('bids');
        currentData = bids;
        filteredData = bids;
        displayBids(bids);
        updatePagination('bids');
    } catch (error) {
        console.error('Error loading bids:', error);
        showAlert('Error loading bids', 'error');
    }
}

function displayBids(bids) {
    const tbody = document.querySelector('#bids-table tbody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageBids = bids.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageBids.map(bid => `
        <tr>
            <td>${bid.id}</td>
            <td>${bid.requestId}</td>
            <td>${bid.driverName || 'Unknown'}</td>
            <td>$${bid.bidAmount}</td>
            <td><span class="status-badge status-${bid.status}">${bid.status}</span></td>
            <td>${formatDateTime(bid.createdAt)}</td>
            <td>
                <button class="action-btn btn-view" onclick="viewBid(${bid.id})">View</button>
                <button class="action-btn btn-delete" onclick="deleteBid(${bid.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Deliveries Management
async function loadDeliveries() {
    try {
        const deliveries = await window.truckDB.read('deliveries');
        currentData = deliveries;
        filteredData = deliveries;
        displayDeliveries(deliveries);
        updatePagination('deliveries');
    } catch (error) {
        console.error('Error loading deliveries:', error);
        showAlert('Error loading deliveries', 'error');
    }
}

function displayDeliveries(deliveries) {
    const tbody = document.querySelector('#deliveries-table tbody');
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageDeliveries = deliveries.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageDeliveries.map(delivery => `
        <tr>
            <td>${delivery.id}</td>
            <td>${delivery.requestId}</td>
            <td>Driver ${delivery.driverId}</td>
            <td>Customer ${delivery.customerId}</td>
            <td>$${delivery.finalPrice}</td>
            <td><span class="status-badge status-${delivery.status}">${delivery.status}</span></td>
            <td>${formatDateTime(delivery.createdAt)}</td>
            <td>
                <button class="action-btn btn-view" onclick="viewDelivery(${delivery.id})">View</button>
                <button class="action-btn btn-edit" onclick="editDelivery(${delivery.id})">Edit</button>
                <button class="action-btn btn-delete" onclick="deleteDelivery(${delivery.id})">Delete</button>
            </td>
        </tr>
    `).join('');
}

// Form Handlers
function setupFormHandlers() {
    // Add Customer Form
    document.getElementById('add-customer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const customerData = Object.fromEntries(formData);
        customerData.type = 'customer'; // Set user type
        
        try {
            await window.truckDB.createUser(customerData);
            closeModal('add-customer-modal');
            loadCustomers();
            refreshStats();
            showAlert('Customer created successfully', 'success');
        } catch (error) {
            console.error('Error creating customer:', error);
            showAlert('Error creating customer', 'error');
        }
    });
    
    // Add Driver Form
    document.getElementById('add-driver-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const driverData = Object.fromEntries(formData);
        driverData.userId = parseInt(driverData.userId);
        
        try {
            await window.truckDB.createDriver(driverData);
            closeModal('add-driver-modal');
            loadDrivers();
            refreshStats();
            showAlert('Driver created successfully', 'success');
        } catch (error) {
            console.error('Error creating driver:', error);
            showAlert('Error creating driver', 'error');
        }
    });
}

// Modal Management
function showAddCustomerModal() {
    document.getElementById('add-customer-modal').style.display = 'block';
}

async function showAddDriverModal() {
    // Load users for driver selection
    const users = await window.truckDB.read('users');
    const drivers = await window.truckDB.read('drivers');
    const driverUserIds = drivers.map(d => d.userId);
    
    const availableUsers = users.filter(u => !driverUserIds.includes(u.id) && u.type === 'driver');
    
    const select = document.getElementById('driver-user-select');
    select.innerHTML = '<option value="">Select User</option>' + 
        availableUsers.map(user => `<option value="${user.id}">${user.name} (${user.email})</option>`).join('');
    
    document.getElementById('add-driver-modal').style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Search and Filter Functions
function searchTable(tableId, searchTerm) {
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tbody')[0].getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cells = row.getElementsByTagName('td');
        let found = false;
        
        for (let j = 0; j < cells.length - 1; j++) { // Exclude actions column
            if (cells[j].textContent.toLowerCase().includes(searchTerm.toLowerCase())) {
                found = true;
                break;
            }
        }
        
        row.style.display = found ? '' : 'none';
    }
}

function filterRequests() {
    const status = document.getElementById('request-status-filter').value;
    if (status) {
        filteredData = currentData.filter(request => request.status === status);
    } else {
        filteredData = currentData;
    }
    displayRequests(filteredData);
}

function filterBids() {
    const status = document.getElementById('bid-status-filter').value;
    if (status) {
        filteredData = currentData.filter(bid => bid.status === status);
    } else {
        filteredData = currentData;
    }
    displayBids(filteredData);
}

function filterDeliveries() {
    const status = document.getElementById('delivery-status-filter').value;
    if (status) {
        filteredData = currentData.filter(delivery => delivery.status === status);
    } else {
        filteredData = currentData;
    }
    displayDeliveries(filteredData);
}

// Data Management Functions
async function loadSampleData() {
    try {
        await window.truckDB.loadInitialData();
        await refreshStats();
        loadUsers();
        showAlert('Sample data loaded successfully', 'success');
    } catch (error) {
        console.error('Error loading sample data:', error);
        showAlert('Error loading sample data', 'error');
    }
}

async function exportData() {
    try {
        const data = await window.truckDB.exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `truckdrive_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showAlert('Data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showAlert('Error exporting data', 'error');
    }
}

function handleFileImport(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const success = await window.truckDB.importData(e.target.result);
            if (success) {
                await refreshStats();
                loadUsers();
                showAlert('Data imported successfully', 'success');
            } else {
                showAlert('Error importing data', 'error');
            }
        } catch (error) {
            console.error('Error importing data:', error);
            showAlert('Error importing data', 'error');
        }
    };
    reader.readAsText(file);
}

function confirmClearData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        clearAllData();
    }
}

async function clearAllData() {
    try {
        await window.truckDB.clearAllData();
        await refreshStats();
        loadUsers();
        showAlert('All data cleared successfully', 'success');
    } catch (error) {
        console.error('Error clearing data:', error);
        showAlert('Error clearing data', 'error');
    }
}

// Maintenance Functions
async function loadMaintenanceInfo() {
    try {
        const dbInfo = await window.truckDB.getDBInfo();
        const infoDiv = document.getElementById('db-info');
        
        infoDiv.innerHTML = `
            <div style="background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <h4>Database Statistics</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Users:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dbInfo.users || 0}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Delivery Requests:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dbInfo.deliveryRequests || 0}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Drivers:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dbInfo.drivers || 0}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Bids:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${dbInfo.bids || 0}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Deliveries:</strong></td><td style="padding: 8px;">${dbInfo.deliveries || 0}</td></tr>
                </table>
                <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
                    <strong>Storage Type:</strong> ${window.truckDB.useLocalStorage ? 'Local Storage' : 'IndexedDB'}<br>
                    <strong>Last Updated:</strong> ${new Date().toLocaleString()}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading maintenance info:', error);
    }
}

// Action Handlers
async function deleteCustomer(customerId) {
    if (confirm('Are you sure you want to delete this customer? This will also delete all their requests and deliveries.')) {
        try {
            // Delete related data first
            const requests = await window.truckDB.query('deliveryRequests', { customerId });
            const deliveries = await window.truckDB.query('deliveries', { customerId });
            
            for (const request of requests) {
                await window.truckDB.delete('deliveryRequests', request.id);
            }
            for (const delivery of deliveries) {
                await window.truckDB.delete('deliveries', delivery.id);
            }
            
            // Delete customer
            await window.truckDB.delete('users', customerId);
            loadCustomers();
            refreshStats();
            showAlert('Customer deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting customer:', error);
            showAlert('Error deleting customer', 'error');
        }
    }
}

async function deleteDriver(driverId) {
    if (confirm('Are you sure you want to delete this driver? This will also delete all their bids and deliveries.')) {
        try {
            // Delete related data first
            const bids = await window.truckDB.query('bids', { driverId });
            const deliveries = await window.truckDB.query('deliveries', { driverId });
            
            for (const bid of bids) {
                await window.truckDB.delete('bids', bid.id);
            }
            for (const delivery of deliveries) {
                await window.truckDB.delete('deliveries', delivery.id);
            }
            
            // Get driver's user ID and delete both records
            const driver = await window.truckDB.read('drivers', driverId);
            if (driver && driver.userId) {
                await window.truckDB.delete('users', driver.userId);
            }
            await window.truckDB.delete('drivers', driverId);
            
            loadDrivers();
            refreshStats();
            showAlert('Driver deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting driver:', error);
            showAlert('Error deleting driver', 'error');
        }
    }
}

// Export Functions
async function exportCustomerData() {
    try {
        const users = await window.truckDB.read('users');
        const requests = await window.truckDB.read('deliveryRequests');
        const deliveries = await window.truckDB.read('deliveries');
        
        const customers = users.filter(user => user.type === 'customer');
        
        const customerData = customers.map(customer => {
            const customerRequests = requests.filter(r => r.customerId === customer.id);
            const customerDeliveries = deliveries.filter(d => d.customerId === customer.id);
            
            return {
                ...customer,
                totalRequests: customerRequests.length,
                totalSpent: customerDeliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0),
                requests: customerRequests,
                deliveries: customerDeliveries
            };
        });
        
        const blob = new Blob([JSON.stringify(customerData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showAlert('Customer data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting customer data:', error);
        showAlert('Error exporting customer data', 'error');
    }
}

async function exportDriverData() {
    try {
        const drivers = await window.truckDB.read('drivers');
        const users = await window.truckDB.read('users');
        const bids = await window.truckDB.read('bids');
        const deliveries = await window.truckDB.read('deliveries');
        
        const driverData = drivers.map(driver => {
            const user = users.find(u => u.id === driver.userId);
            const driverBids = bids.filter(b => b.driverId === driver.id);
            const driverDeliveries = deliveries.filter(d => d.driverId === driver.id);
            
            return {
                ...driver,
                userInfo: user,
                totalBids: driverBids.length,
                totalEarnings: driverDeliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0),
                bids: driverBids,
                deliveries: driverDeliveries
            };
        });
        
        const blob = new Blob([JSON.stringify(driverData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drivers_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showAlert('Driver data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting driver data:', error);
        showAlert('Error exporting driver data', 'error');
    }
}

async function exportRequestData() {
    try {
        const requests = await window.truckDB.read('deliveryRequests');
        const bids = await window.truckDB.read('bids');
        const users = await window.truckDB.read('users');
        
        const requestData = requests.map(request => {
            const customer = users.find(u => u.id === request.customerId);
            const requestBids = bids.filter(b => b.requestId === request.id);
            
            return {
                ...request,
                customerInfo: customer,
                bids: requestBids,
                bidCount: requestBids.length
            };
        });
        
        const blob = new Blob([JSON.stringify(requestData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `requests_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showAlert('Request data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting request data:', error);
        showAlert('Error exporting request data', 'error');
    }
}

// Detail View Functions
async function viewCustomerDetails(customerId) {
    try {
        const customer = await window.truckDB.read('users', customerId);
        const requests = await window.truckDB.query('deliveryRequests', { customerId });
        const deliveries = await window.truckDB.query('deliveries', { customerId });
        
        const totalSpent = deliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0);
        const completedDeliveries = deliveries.filter(d => d.status === 'completed').length;
        
        alert(`Customer Details:
Name: ${customer.name}
Email: ${customer.email}
Phone: ${customer.phone}
Total Requests: ${requests.length}
Completed Deliveries: ${completedDeliveries}
Total Spent: $${totalSpent.toFixed(2)}
Member Since: ${formatDate(customer.createdAt)}`);
    } catch (error) {
        console.error('Error viewing customer details:', error);
        showAlert('Error loading customer details', 'error');
    }
}

async function viewDriverDetails(driverId) {
    try {
        const driver = await window.truckDB.read('drivers', driverId);
        const user = await window.truckDB.read('users', driver.userId);
        const bids = await window.truckDB.query('bids', { driverId });
        const deliveries = await window.truckDB.query('deliveries', { driverId });
        
        const totalEarnings = deliveries.reduce((sum, d) => sum + (d.finalPrice || 0), 0);
        const completedDeliveries = deliveries.filter(d => d.status === 'completed').length;
        
        alert(`Driver Details:
Name: ${user.name}
Email: ${user.email}
Phone: ${user.phone}
Truck Type: ${getTruckTypeLabel(driver.truckType)}
License Plate: ${driver.licensePlate}
Rating: ${driver.rating || 5.0} ⭐
Total Bids: ${bids.length}
Completed Deliveries: ${completedDeliveries}
Total Earnings: $${totalEarnings.toFixed(2)}
Available: ${driver.isAvailable ? 'Yes' : 'No'}
Driver Since: ${formatDate(user.createdAt)}`);
    } catch (error) {
        console.error('Error viewing driver details:', error);
        showAlert('Error loading driver details', 'error');
    }
}

async function deleteRequest(requestId) {
    if (confirm('Are you sure you want to delete this request?')) {
        try {
            await window.truckDB.delete('deliveryRequests', requestId);
            loadRequests();
            refreshStats();
            showAlert('Request deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting request:', error);
            showAlert('Error deleting request', 'error');
        }
    }
}

async function deleteDriver(driverId) {
    if (confirm('Are you sure you want to delete this driver?')) {
        try {
            await window.truckDB.delete('drivers', driverId);
            loadDrivers();
            refreshStats();
            showAlert('Driver deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting driver:', error);
            showAlert('Error deleting driver', 'error');
        }
    }
}

async function deleteBid(bidId) {
    if (confirm('Are you sure you want to delete this bid?')) {
        try {
            await window.truckDB.delete('bids', bidId);
            loadBids();
            refreshStats();
            showAlert('Bid deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting bid:', error);
            showAlert('Error deleting bid', 'error');
        }
    }
}

async function deleteDelivery(deliveryId) {
    if (confirm('Are you sure you want to delete this delivery?')) {
        try {
            await window.truckDB.delete('deliveries', deliveryId);
            loadDeliveries();
            refreshStats();
            showAlert('Delivery deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting delivery:', error);
            showAlert('Error deleting delivery', 'error');
        }
    }
}

// View functions (enhanced)
function editCustomer(customerId) { 
    alert(`Edit customer ${customerId} - Feature coming soon! This will open a detailed edit form.`); 
}

function editDriver(driverId) { 
    alert(`Edit driver ${driverId} - Feature coming soon! This will open a detailed edit form.`); 
}

function viewRequest(requestId) { alert(`View request ${requestId} - Feature coming soon!`); }
function editRequest(requestId) { alert(`Edit request ${requestId} - Feature coming soon!`); }
function viewBid(bidId) { alert(`View bid ${bidId} - Feature coming soon!`); }
function viewDelivery(deliveryId) { alert(`View delivery ${deliveryId} - Feature coming soon!`); }
function editDelivery(deliveryId) { alert(`Edit delivery ${deliveryId} - Feature coming soon!`); }

// Utility Functions
function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function getTruckTypeLabel(type) {
    const labels = {
        'small': 'Small Truck (up to 1.5 tons)',
        'medium': 'Medium Truck (1.5-3 tons)',
        'large': 'Large Truck (3-5 tons)',
        'xlarge': 'Extra Large (5+ tons)'
    };
    return labels[type] || type || 'Unknown';
}

function truncateText(text, length) {
    if (!text) return 'N/A';
    return text.length > length ? text.substring(0, length) + '...' : text;
}

function showAlert(message, type = 'info') {
    // Remove existing alerts
    document.querySelectorAll('.admin-alert').forEach(alert => alert.remove());
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `admin-alert alert-${type}`;
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        z-index: 9999;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        max-width: 400px;
    `;
    
    switch(type) {
        case 'success':
            alertDiv.style.background = '#27ae60';
            break;
        case 'error':
            alertDiv.style.background = '#e74c3c';
            break;
        case 'warning':
            alertDiv.style.background = '#f39c12';
            break;
        default:
            alertDiv.style.background = '#3498db';
    }
    
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function updatePagination(tableName) {
    // Simple pagination - for production, implement proper pagination
    console.log(`Pagination for ${tableName} - showing ${filteredData.length} items`);
}
