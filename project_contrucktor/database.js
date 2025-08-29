// Database Management System for TruckDrive
class TruckDriveDB {
    constructor() {
        this.dbName = 'TruckDriveDB';
        this.version = 1;
        this.db = null;
        this.isReady = false;
        this.init();
    }

    // Initialize Database
    async init() {
        try {
            // Check if IndexedDB is available
            if (!window.indexedDB) {
                console.warn('IndexedDB not available, falling back to localStorage');
                this.fallbackToLocalStorage();
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Database failed to open');
                this.fallbackToLocalStorage();
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('Database opened successfully');
                // Disabled automatic initial data loading
                // this.loadInitialData();
            };

            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                this.createTables();
            };

        } catch (error) {
            console.error('Database initialization error:', error);
            this.fallbackToLocalStorage();
        }
    }

    // Create Database Tables
    createTables() {
        // Users table
        if (!this.db.objectStoreNames.contains('users')) {
            const usersStore = this.db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
            usersStore.createIndex('email', 'email', { unique: true });
            usersStore.createIndex('phone', 'phone', { unique: false });
            usersStore.createIndex('type', 'type', { unique: false });
        }

        // Delivery Requests table
        if (!this.db.objectStoreNames.contains('deliveryRequests')) {
            const requestsStore = this.db.createObjectStore('deliveryRequests', { keyPath: 'id', autoIncrement: true });
            requestsStore.createIndex('customerId', 'customerId', { unique: false });
            requestsStore.createIndex('status', 'status', { unique: false });
            requestsStore.createIndex('truckType', 'truckType', { unique: false });
            requestsStore.createIndex('date', 'date', { unique: false });
        }

        // Drivers table
        if (!this.db.objectStoreNames.contains('drivers')) {
            const driversStore = this.db.createObjectStore('drivers', { keyPath: 'id', autoIncrement: true });
            driversStore.createIndex('userId', 'userId', { unique: true });
            driversStore.createIndex('truckType', 'truckType', { unique: false });
            driversStore.createIndex('rating', 'rating', { unique: false });
            driversStore.createIndex('isAvailable', 'isAvailable', { unique: false });
        }

        // Bids table
        if (!this.db.objectStoreNames.contains('bids')) {
            const bidsStore = this.db.createObjectStore('bids', { keyPath: 'id', autoIncrement: true });
            bidsStore.createIndex('requestId', 'requestId', { unique: false });
            bidsStore.createIndex('driverId', 'driverId', { unique: false });
            bidsStore.createIndex('status', 'status', { unique: false });
            bidsStore.createIndex('bidAmount', 'bidAmount', { unique: false });
        }

        // Deliveries table
        if (!this.db.objectStoreNames.contains('deliveries')) {
            const deliveriesStore = this.db.createObjectStore('deliveries', { keyPath: 'id', autoIncrement: true });
            deliveriesStore.createIndex('requestId', 'requestId', { unique: true });
            deliveriesStore.createIndex('driverId', 'driverId', { unique: false });
            deliveriesStore.createIndex('customerId', 'customerId', { unique: false });
            deliveriesStore.createIndex('status', 'status', { unique: false });
        }

        console.log('Database tables created successfully');
    }

    // Fallback to localStorage
    fallbackToLocalStorage() {
        this.isReady = true;
        this.useLocalStorage = true;
        console.log('Using localStorage as database fallback');
        // Disabled automatic initial data loading
        // this.loadInitialData();
    }

    // Generic CRUD Operations
    async create(tableName, data) {
        if (this.useLocalStorage) {
            return this.createLS(tableName, data);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([tableName], 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.add(data);

            request.onsuccess = () => {
                resolve({ ...data, id: request.result });
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    async read(tableName, id = null) {
        if (this.useLocalStorage) {
            return this.readLS(tableName, id);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([tableName], 'readonly');
            const store = transaction.objectStore(tableName);
            
            if (id) {
                const request = store.get(id);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } else {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            }
        });
    }

    async update(tableName, data) {
        if (this.useLocalStorage) {
            return this.updateLS(tableName, data);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([tableName], 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(tableName, id) {
        if (this.useLocalStorage) {
            return this.deleteLS(tableName, id);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([tableName], 'readwrite');
            const store = transaction.objectStore(tableName);
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // Query with filters
    async query(tableName, filters = {}) {
        if (this.useLocalStorage) {
            return this.queryLS(tableName, filters);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([tableName], 'readonly');
            const store = transaction.objectStore(tableName);
            const request = store.getAll();

            request.onsuccess = () => {
                let results = request.result;
                
                // Apply filters
                Object.keys(filters).forEach(key => {
                    results = results.filter(item => {
                        if (typeof filters[key] === 'object' && filters[key].operator) {
                            return this.applyOperator(item[key], filters[key].value, filters[key].operator);
                        }
                        return item[key] === filters[key];
                    });
                });

                resolve(results);
            };

            request.onerror = () => reject(request.error);
        });
    }

    // Apply filter operators
    applyOperator(value, filterValue, operator) {
        switch (operator) {
            case '>': return value > filterValue;
            case '<': return value < filterValue;
            case '>=': return value >= filterValue;
            case '<=': return value <= filterValue;
            case '!=': return value !== filterValue;
            case 'contains': return value.toLowerCase().includes(filterValue.toLowerCase());
            case 'startsWith': return value.toLowerCase().startsWith(filterValue.toLowerCase());
            default: return value === filterValue;
        }
    }

    // LocalStorage Implementation
    createLS(tableName, data) {
        const items = JSON.parse(localStorage.getItem(tableName) || '[]');
        const id = Date.now() + Math.random();
        const newItem = { ...data, id };
        items.push(newItem);
        localStorage.setItem(tableName, JSON.stringify(items));
        return Promise.resolve(newItem);
    }

    readLS(tableName, id = null) {
        const items = JSON.parse(localStorage.getItem(tableName) || '[]');
        if (id) {
            return Promise.resolve(items.find(item => item.id === id));
        }
        return Promise.resolve(items);
    }

    updateLS(tableName, data) {
        const items = JSON.parse(localStorage.getItem(tableName) || '[]');
        const index = items.findIndex(item => item.id === data.id);
        if (index !== -1) {
            items[index] = data;
            localStorage.setItem(tableName, JSON.stringify(items));
        }
        return Promise.resolve(data);
    }

    deleteLS(tableName, id) {
        const items = JSON.parse(localStorage.getItem(tableName) || '[]');
        const filtered = items.filter(item => item.id !== id);
        localStorage.setItem(tableName, JSON.stringify(filtered));
        return Promise.resolve(true);
    }

    queryLS(tableName, filters = {}) {
        const items = JSON.parse(localStorage.getItem(tableName) || '[]');
        let results = items;

        Object.keys(filters).forEach(key => {
            results = results.filter(item => {
                if (typeof filters[key] === 'object' && filters[key].operator) {
                    return this.applyOperator(item[key], filters[key].value, filters[key].operator);
                }
                return item[key] === filters[key];
            });
        });

        return Promise.resolve(results);
    }

    // Specialized Methods for TruckDrive

    // User Management
    async createUser(userData) {
        userData.createdAt = new Date().toISOString();
        userData.isActive = true;
        return await this.create('users', userData);
    }

    async getUserByEmail(email) {
        const users = await this.query('users', { email });
        return users[0] || null;
    }

    async authenticateUser(email, password) {
        const user = await this.getUserByEmail(email);
        if (user && user.password === password) {
            return { ...user, password: undefined }; // Remove password from response
        }
        return null;
    }

    // Delivery Request Management
    async createDeliveryRequest(requestData) {
        requestData.createdAt = new Date().toISOString();
        requestData.status = 'pending';
        requestData.bidCount = 0;
        requestData.assignedDriverId = null;
        requestData.acceptedAt = null;
        // Extract city from pickup location for location-based matching
        requestData.pickupCity = this.extractCityFromLocation(requestData.pickupLocation);
        return await this.create('deliveryRequests', requestData);
    }

    async getRequestsByCustomer(customerId) {
        return await this.query('deliveryRequests', { customerId });
    }

    async getAvailableRequests(filters = {}) {
        const baseFilters = { status: 'pending', ...filters };
        return await this.query('deliveryRequests', baseFilters);
    }

    async getRequestsByCity(city) {
        return await this.query('deliveryRequests', { pickupCity: city, status: 'pending' });
    }

    async acceptDeliveryRequest(requestId, driverId) {
        const request = await this.read('deliveryRequests', requestId);
        if (request && request.status === 'pending') {
            request.status = 'accepted';
            request.assignedDriverId = driverId;
            request.acceptedAt = new Date().toISOString();
            request.updatedAt = new Date().toISOString();
            
            // Update driver availability
            await this.setDriverAvailability(driverId, false);
            
            return await this.update('deliveryRequests', request);
        }
        return null;
    }

    async declineDeliveryRequest(requestId, driverId) {
        // Add to declined drivers list so they don't see it again
        const request = await this.read('deliveryRequests', requestId);
        if (request) {
            if (!request.declinedDrivers) {
                request.declinedDrivers = [];
            }
            if (!request.declinedDrivers.includes(driverId)) {
                request.declinedDrivers.push(driverId);
                return await this.update('deliveryRequests', request);
            }
        }
        return null;
    }

    // Helper function to extract city from location string
    extractCityFromLocation(location) {
        // Simple city extraction - you can enhance this based on your location format
        const parts = location.split(',');
        if (parts.length >= 2) {
            return parts[parts.length - 2].trim(); // Second to last part is usually city
        }
        return location.trim();
    }

    async updateRequestStatus(requestId, status) {
        const request = await this.read('deliveryRequests', requestId);
        if (request) {
            request.status = status;
            request.updatedAt = new Date().toISOString();
            return await this.update('deliveryRequests', request);
        }
        return null;
    }

    // Driver Management
    async createDriver(driverData) {
        driverData.createdAt = new Date().toISOString();
        driverData.isAvailable = true;
        driverData.rating = 5.0;
        driverData.totalDeliveries = 0;
        driverData.currentLocation = null; // For location tracking
        driverData.currentCity = null; // For city-based matching
        return await this.create('drivers', driverData);
    }

    async updateDriverLocation(driverId, location, city) {
        const driver = await this.read('drivers', driverId);
        if (driver) {
            driver.currentLocation = location;
            driver.currentCity = city;
            driver.lastLocationUpdate = new Date().toISOString();
            return await this.update('drivers', driver);
        }
        return null;
    }

    async getDriversByCity(city) {
        return await this.query('drivers', { currentCity: city, isAvailable: true });
    }

    async getDriverByUserId(userId) {
        const drivers = await this.query('drivers', { userId });
        return drivers[0] || null;
    }

    async getAvailableDrivers(truckType = null) {
        const filters = { isAvailable: true };
        if (truckType) {
            filters.truckType = truckType;
        }
        return await this.query('drivers', filters);
    }

    async setDriverAvailability(driverId, isAvailable) {
        const driver = await this.read('drivers', driverId);
        if (driver) {
            driver.isAvailable = isAvailable;
            driver.statusUpdatedAt = new Date().toISOString();
            return await this.update('drivers', driver);
        }
        return null;
    }

    // Bid Management
    async createBid(bidData) {
        bidData.createdAt = new Date().toISOString();
        bidData.status = 'pending';
        bidData.message = bidData.message || ''; // Optional message from driver
        
        // Get driver and customer info for notifications
        const driver = await this.read('drivers', bidData.driverId);
        const driverUser = await this.read('users', driver.userId);
        const request = await this.read('deliveryRequests', bidData.requestId);
        
        bidData.driverName = driverUser.name;
        bidData.driverPhone = driverUser.phone;
        bidData.truckType = driver.truckType;
        bidData.truckModel = driver.truckModel;
        bidData.driverRating = driver.rating;
        
        // Update bid count on request
        if (request) {
            request.bidCount = (request.bidCount || 0) + 1;
            await this.update('deliveryRequests', request);
        }

        return await this.create('bids', bidData);
    }

    async getBidsByRequest(requestId) {
        return await this.query('bids', { requestId });
    }

    async getBidsByDriver(driverId) {
        return await this.query('bids', { driverId });
    }

    async getBidsForCustomer(customerId) {
        // Get all requests by customer, then get bids for those requests
        const customerRequests = await this.query('deliveryRequests', { customerId });
        const allBids = [];
        
        for (const request of customerRequests) {
            const requestBids = await this.query('bids', { requestId: request.id });
            // Add request info to each bid
            requestBids.forEach(bid => {
                bid.requestInfo = request;
            });
            allBids.push(...requestBids);
        }
        
        return allBids;
    }

    async acceptBid(bidId, customerId) {
        const bid = await this.read('bids', bidId);
        if (bid) {
            // Verify this bid belongs to customer's request
            const request = await this.read('deliveryRequests', bid.requestId);
            if (request.customerId !== customerId) {
                throw new Error('Unauthorized: This bid does not belong to your request');
            }

            // Update bid status
            bid.status = 'accepted';
            bid.acceptedAt = new Date().toISOString();
            await this.update('bids', bid);

            // Update request status
            await this.updateRequestStatus(bid.requestId, 'accepted');
            request.assignedDriverId = bid.driverId;
            request.finalPrice = bid.bidAmount;
            await this.update('deliveryRequests', request);

            // Reject other bids for the same request
            const otherBids = await this.query('bids', { 
                requestId: bid.requestId, 
                status: 'pending' 
            });
            
            for (const otherBid of otherBids) {
                if (otherBid.id !== bidId) {
                    otherBid.status = 'rejected';
                    await this.update('bids', otherBid);
                }
            }

            // Create delivery record and contact info
            await this.createDelivery({
                requestId: bid.requestId,
                driverId: bid.driverId,
                customerId: bid.customerId,
                finalPrice: bid.bidAmount,
                status: 'assigned'
            });

            // Create contact record for communication
            await this.createContact({
                requestId: bid.requestId,
                customerId: bid.customerId,
                driverId: bid.driverId,
                bidId: bidId,
                status: 'active'
            });

            return bid;
        }
        return null;
    }

    async declineBid(bidId, customerId) {
        const bid = await this.read('bids', bidId);
        if (bid) {
            // Verify this bid belongs to customer's request
            const request = await this.read('deliveryRequests', bid.requestId);
            if (request.customerId !== customerId) {
                throw new Error('Unauthorized: This bid does not belong to your request');
            }

            bid.status = 'declined';
            bid.declinedAt = new Date().toISOString();
            return await this.update('bids', bid);
        }
        return null;
    }

    // Delivery Management
    async createDelivery(deliveryData) {
        deliveryData.createdAt = new Date().toISOString();
        deliveryData.estimatedDelivery = this.calculateEstimatedDelivery();
        return await this.create('deliveries', deliveryData);
    }

    async getDeliveriesByDriver(driverId) {
        return await this.query('deliveries', { driverId });
    }

    async getDeliveriesByCustomer(customerId) {
        return await this.query('deliveries', { customerId });
    }

    async updateDeliveryStatus(deliveryId, status) {
        const delivery = await this.read('deliveries', deliveryId);
        if (delivery) {
            delivery.status = status;
            delivery.updatedAt = new Date().toISOString();
            
            if (status === 'completed') {
                delivery.completedAt = new Date().toISOString();
                
                // Update driver stats
                const driver = await this.read('drivers', delivery.driverId);
                if (driver) {
                    driver.totalDeliveries = (driver.totalDeliveries || 0) + 1;
                    await this.update('drivers', driver);
                }
            }
            
            return await this.update('deliveries', delivery);
        }
        return null;
    }

    // Contact Management for Customer-Driver Communication
    async createContact(contactData) {
        contactData.createdAt = new Date().toISOString();
        contactData.lastMessage = null;
        contactData.messageCount = 0;
        return await this.create('contacts', contactData);
    }

    async getContactsByCustomer(customerId) {
        const contacts = await this.query('contacts', { customerId });
        // Enhance with driver and request info
        for (const contact of contacts) {
            const driver = await this.read('drivers', contact.driverId);
            const driverUser = await this.read('users', driver.userId);
            const request = await this.read('deliveryRequests', contact.requestId);
            
            contact.driverInfo = {
                name: driverUser.name,
                phone: driverUser.phone,
                truckType: driver.truckType,
                truckModel: driver.truckModel,
                rating: driver.rating
            };
            contact.requestInfo = request;
        }
        return contacts;
    }

    async getContactsByDriver(driverId) {
        const contacts = await this.query('contacts', { driverId });
        // Enhance with customer and request info
        for (const contact of contacts) {
            const customerUser = await this.read('users', contact.customerId);
            const request = await this.read('deliveryRequests', contact.requestId);
            
            contact.customerInfo = {
                name: customerUser.name,
                phone: customerUser.phone
            };
            contact.requestInfo = request;
        }
        return contacts;
    }

    async addMessage(contactId, senderId, message) {
        const contact = await this.read('contacts', contactId);
        if (contact) {
            const messageData = {
                contactId: contactId,
                senderId: senderId,
                message: message,
                timestamp: new Date().toISOString()
            };
            
            // Create message record
            await this.create('messages', messageData);
            
            // Update contact with last message info
            contact.lastMessage = message;
            contact.messageCount = (contact.messageCount || 0) + 1;
            contact.lastMessageAt = new Date().toISOString();
            await this.update('contacts', contact);
            
            return messageData;
        }
        return null;
    }

    async getMessages(contactId) {
        return await this.query('messages', { contactId });
    }

    // Utility Methods
    calculateEstimatedDelivery() {
        const now = new Date();
        now.setHours(now.getHours() + Math.floor(Math.random() * 4) + 1); // 1-4 hours
        return now.toISOString();
    }

    // Analytics Methods
    async getDriverStats(driverId) {
        const deliveries = await this.getDeliveriesByDriver(driverId);
        const bids = await this.getBidsByDriver(driverId);
        
        return {
            totalDeliveries: deliveries.length,
            completedDeliveries: deliveries.filter(d => d.status === 'completed').length,
            totalBids: bids.length,
            acceptedBids: bids.filter(b => b.status === 'accepted').length,
            averageRating: this.calculateAverageRating(deliveries),
            totalEarnings: deliveries
                .filter(d => d.status === 'completed')
                .reduce((sum, d) => sum + d.finalPrice, 0)
        };
    }

    async getCustomerStats(customerId) {
        const requests = await this.getRequestsByCustomer(customerId);
        const deliveries = await this.getDeliveriesByCustomer(customerId);
        
        return {
            totalRequests: requests.length,
            completedDeliveries: deliveries.filter(d => d.status === 'completed').length,
            totalSpent: deliveries
                .filter(d => d.status === 'completed')
                .reduce((sum, d) => sum + d.finalPrice, 0),
            averageBidCount: requests.reduce((sum, r) => sum + (r.bidCount || 0), 0) / requests.length || 0
        };
    }

    calculateAverageRating(deliveries) {
        const ratedDeliveries = deliveries.filter(d => d.customerRating);
        if (ratedDeliveries.length === 0) return 5.0;
        
        const sum = ratedDeliveries.reduce((sum, d) => sum + d.customerRating, 0);
        return (sum / ratedDeliveries.length).toFixed(1);
    }

    // Load initial sample data (only when explicitly called)
    async loadInitialData() {
        // Check if data already exists
        const existingUsers = await this.read('users');
        if (existingUsers && existingUsers.length > 0) {
            console.log('Database already has data, skipping initial data load');
            return;
        }

        console.log('Loading initial sample data...');

        // Sample Users - THESE ARE THE USERS THAT KEEP REAPPEARING
        const sampleUsers = [
            {
                name: 'John Doe',
                email: 'john@example.com',
                password: '123456',
                phone: '+1234567890',
                type: 'customer'
            },
            {
                name: 'Ahmed Hassan',
                email: 'ahmed@example.com',
                password: '123456',
                phone: '+1234567891',
                type: 'driver'
            },
            {
                name: 'Sarah Wilson',
                email: 'sarah@example.com',
                password: '123456',
                phone: '+1234567892',
                type: 'driver'
            }
        ];

        for (const user of sampleUsers) {
            await this.createUser(user);
        }

        // Sample Drivers
        const users = await this.read('users');
        const driverUsers = users.filter(u => u.type === 'driver');
        
        const sampleDrivers = [
            {
                userId: driverUsers[0]?.id,
                truckType: 'medium',
                truckModel: 'Ford Transit',
                licensePlate: 'ABC-123',
                experience: '5 years',
                rating: 4.8
            },
            {
                userId: driverUsers[1]?.id,
                truckType: 'large',
                truckModel: 'Mercedes Sprinter',
                licensePlate: 'XYZ-789',
                experience: '7 years',
                rating: 4.9
            }
        ];

        for (const driver of sampleDrivers) {
            if (driver.userId) {
                await this.createDriver(driver);
            }
        }

        console.log('Initial data loaded successfully');
    }

    // Export/Import Functions
    async exportData() {
        const data = {};
        const tables = ['users', 'deliveryRequests', 'drivers', 'bids', 'deliveries'];
        
        for (const table of tables) {
            data[table] = await this.read(table);
        }
        
        return JSON.stringify(data, null, 2);
    }

    async importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            const tables = ['users', 'deliveryRequests', 'drivers', 'bids', 'deliveries'];
            
            for (const table of tables) {
                if (data[table]) {
                    // Clear existing data
                    const existing = await this.read(table);
                    for (const item of existing) {
                        await this.delete(table, item.id);
                    }
                    
                    // Import new data
                    for (const item of data[table]) {
                        await this.create(table, item);
                    }
                }
            }
            
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }

    // Database maintenance
    async clearAllData() {
        const tables = ['users', 'deliveryRequests', 'drivers', 'bids', 'deliveries'];
        
        console.log('COMPLETE DATABASE CLEARING - IndexedDB + localStorage + Cache');
        
        // Clear IndexedDB
        if (this.db) {
            console.log('Clearing IndexedDB...');
            for (const table of tables) {
                try {
                    const items = await this.read(table);
                    console.log(`Clearing ${items.length} items from ${table} table`);
                    for (const item of items) {
                        await this.delete(table, item.id);
                    }
                } catch (error) {
                    console.error(`Error clearing ${table}:`, error);
                }
            }
            
            // Close and delete the entire IndexedDB database
            try {
                console.log('Closing IndexedDB connection...');
                this.db.close();
                
                console.log('Deleting entire IndexedDB database...');
                const deleteRequest = indexedDB.deleteDatabase('TruckDriveDB');
                
                await new Promise((resolve, reject) => {
                    deleteRequest.onsuccess = () => {
                        console.log('IndexedDB database deleted successfully');
                        resolve();
                    };
                    deleteRequest.onerror = () => {
                        console.error('Error deleting IndexedDB database');
                        reject(deleteRequest.error);
                    };
                    deleteRequest.onblocked = () => {
                        console.log('IndexedDB deletion blocked');
                        resolve(); // Continue anyway
                    };
                });
                
                // Reinitialize database
                this.db = null;
                this.isReady = false;
                
            } catch (error) {
                console.error('Error deleting IndexedDB:', error);
            }
        }
        
        // Clear localStorage fallback
        console.log('Clearing localStorage fallback...');
        for (const table of tables) {
            try {
                localStorage.removeItem(`truckDB_${table}`);
                console.log(`Cleared localStorage for ${table}`);
            } catch (error) {
                console.error(`Error clearing localStorage for ${table}:`, error);
            }
        }
        
        // Clear any other localStorage items related to the app
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('truckDB_') || key.includes('truck') || key.includes('user') || key.includes('User'))) {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            try {
                localStorage.removeItem(key);
                console.log(`Removed localStorage key: ${key}`);
            } catch (error) {
                console.error(`Error removing localStorage key ${key}:`, error);
            }
        });
        
        // Clear sessionStorage
        try {
            sessionStorage.clear();
            console.log('SessionStorage cleared');
        } catch (error) {
            console.error('Error clearing sessionStorage:', error);
        }
        
        console.log('COMPLETE DATABASE CLEARING FINISHED - All data should be permanently deleted');
    }

    async getDBInfo() {
        const tables = ['users', 'deliveryRequests', 'drivers', 'bids', 'deliveries'];
        const info = {};
        
        for (const table of tables) {
            const items = await this.read(table);
            info[table] = items ? items.length : 0;
        }
        
        return info;
    }
}

// Initialize global database instance
window.truckDB = new TruckDriveDB();
