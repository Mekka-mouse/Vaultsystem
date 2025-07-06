// Global variables
let vehicles = [];
let currentTab = 'dashboard';

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    loadVehicles();
    loadFleetStats();
    setupEventListeners();
    
    // Set current time for checkout
    updateCheckoutTime();
});

// Setup event listeners
function setupEventListeners() {
    // Form submissions
    document.getElementById('checkout-form').addEventListener('submit', handleCheckout);
    document.getElementById('return-form').addEventListener('submit', handleReturn);
    document.getElementById('maintenance-form').addEventListener('submit', handleMaintenance);
}

// Tab management
function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Add active class to corresponding nav tab
    event.target.classList.add('active');
    
    currentTab = tabName;
    
    // Load specific tab data
    if (tabName === 'dashboard') {
        loadVehicles();
        loadFleetStats();
    } else if (tabName === 'reports') {
        // Reports tab now uses on-demand report generation
    } else if (tabName === 'maintenance') {
        loadMaintenanceHistory();
    }
}

// Load vehicles from API
async function loadVehicles() {
    try {
        const response = await fetch('/api/vehicles');
        vehicles = await response.json();
        
        if (currentTab === 'dashboard') {
            displayVehicles();
        }
        
        populateVehicleSelects();
    } catch (error) {
        console.error('Error loading vehicles:', error);
        showAlert('danger', 'Failed to load vehicles');
    }
}

// Display vehicles in dashboard
async function displayVehicles() {
    const container = document.getElementById('vehicle-dashboard');
    container.innerHTML = '';
    
    // Load all checkouts to get driver info
    let checkouts = [];
    try {
        const response = await fetch('/api/reports/checkouts');
        checkouts = await response.json();
    } catch (error) {
        console.error('Error loading checkouts:', error);
    }
    
    vehicles.forEach(vehicle => {
        const vehicleCard = document.createElement('div');
        vehicleCard.className = `vehicle-card ${vehicle.status.replace('_', '-')}`;
        
        // Find active checkout for this vehicle
        const activeCheckout = checkouts.find(checkout => 
            checkout.vehicle_id === vehicle.id && !checkout.is_returned
        );
        
        let driverInfo = 'Available';
        let locationInfo = vehicle.location || '150 Peabody Place';
        
        if (vehicle.status === 'checked_out' && activeCheckout) {
            driverInfo = activeCheckout.driver_name;
            locationInfo = activeCheckout.purpose;
        } else if (vehicle.status === 'maintenance') {
            driverInfo = 'In Maintenance';
            locationInfo = 'Service Bay';
        }
        
        vehicleCard.innerHTML = `
            <div class="vehicle-status status-${vehicle.status.replace('_', '-')}">${vehicle.status.replace('_', ' ').toUpperCase()}</div>
            <h3>${vehicle.name}</h3>
            <p><strong>Make/Model:</strong> ${vehicle.make} ${vehicle.model} (${vehicle.year})</p>
            <p><strong>License Plate:</strong> ${vehicle.license_plate}</p>
            <p><strong>Driver:</strong> ${driverInfo}</p>
            <p><strong>Current Mileage:</strong> ${vehicle.current_mileage.toLocaleString()}</p>
            <p><strong>Location:</strong> ${locationInfo}</p>
            ${vehicle.garage_level ? `<p><strong>Garage Level:</strong> ${vehicle.garage_level}</p>` : ''}
        `;
        container.appendChild(vehicleCard);
    });
}

// Populate vehicle select dropdowns
function populateVehicleSelects() {
    const selects = ['checkout-vehicle', 'return-vehicle', 'maintenance-vehicle'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">-- Select Vehicle --</option>';
        
        vehicles.forEach(vehicle => {
            const option = document.createElement('option');
            option.value = vehicle.id;
            option.textContent = `${vehicle.name} - ${vehicle.license_plate}`;
            
            // Only show available vehicles for checkout (exclude reserved/executive vehicles)
            if (selectId === 'checkout-vehicle') {
                if (vehicle.status !== 'available' || vehicle.access_level === 'executive') {
                    option.disabled = true;
                    if (vehicle.access_level === 'executive') {
                        // Show actual status for executive vehicles (maintenance or reserved)
                        if (vehicle.status === 'maintenance') {
                            option.textContent += ` (EXECUTIVE - MAINTENANCE)`;
                        } else {
                            option.textContent += ` (EXECUTIVE - RESERVED)`;
                        }
                    } else {
                        option.textContent += ` (${vehicle.status.replace('_', ' ').toUpperCase()})`;
                    }
                }
            }
            
            // Only show checked out vehicles for return
            if (selectId === 'return-vehicle' && vehicle.status !== 'checked_out') {
                option.disabled = true;
                option.textContent += ` (${vehicle.status.replace('_', ' ').toUpperCase()})`;
            }
            
            // For maintenance dropdown, show all vehicles with status info
            if (selectId === 'maintenance-vehicle' && vehicle.status !== 'available') {
                if (vehicle.access_level === 'executive' && vehicle.status !== 'maintenance') {
                    option.textContent += ` (EXECUTIVE - RESERVED)`;
                } else {
                    option.textContent += ` (${vehicle.status.replace('_', ' ').toUpperCase()})`;
                }
            }
            
            select.appendChild(option);
        });
    });
}

// Load fleet statistics
async function loadFleetStats() {
    try {
        const response = await fetch('/api/fleet-stats');
        const stats = await response.json();
        
        document.getElementById('available-count').textContent = stats.available;
        document.getElementById('checked-out-count').textContent = stats.checked_out;
        document.getElementById('maintenance-count').textContent = stats.maintenance;
    } catch (error) {
        console.error('Error loading fleet stats:', error);
    }
}

// Update checkout time to current time
function updateCheckoutTime() {
    const now = new Date();
    // Convert to local timezone and format for datetime-local input
    const localISOString = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.getElementById('checkout-time').value = localISOString;
    
    // Also display human-readable time
    const timeDisplay = document.getElementById('checkout-time-display');
    if (timeDisplay) {
        timeDisplay.textContent = now.toLocaleString();
    }
}

// Handle vehicle checkout
async function handleCheckout(e) {
    e.preventDefault();
    
    // Update checkout time right before submission
    updateCheckoutTime();
    
    const vehicleId = parseInt(document.getElementById('checkout-vehicle').value);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    
    // Validate PIN for management vehicles
    if (vehicle && vehicle.access_level === 'management') {
        const enteredPin = document.getElementById('management-pin').value;
        const correctPin = '1234'; // Management PIN
        
        if (enteredPin !== correctPin) {
            showAlert('danger', 'Invalid management PIN. Access denied.', 'checkout-alert');
            return;
        }
    }
    
    // Prevent checkout of executive/reserved vehicles
    if (vehicle && vehicle.access_level === 'executive') {
        showAlert('danger', 'Executive vehicles cannot be checked out.', 'checkout-alert');
        return;
    }
    
    const formData = {
        vehicle_id: vehicleId,
        driver_name: document.getElementById('driver-name').value,
        purpose: document.getElementById('checkout-purpose').value,
        expected_return_date: document.getElementById('checkout-time').value,
        checkout_mileage: parseInt(document.getElementById('mileage-out').value)
    };
    
    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('success', 'Vehicle checked out successfully!', 'checkout-alert');
            document.getElementById('checkout-form').reset();
            loadVehicles();
            loadFleetStats();
        } else {
            showAlert('danger', result.error || 'An error occurred during checkout', 'checkout-alert');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('danger', 'An error occurred during checkout', 'checkout-alert');
    }
}

// Toggle supply checkboxes visibility
function toggleSupplyCheckboxes() {
    const suppliesStocked = document.getElementById('supplies-stocked').value;
    const checkboxContainer = document.getElementById('supply-checkboxes');
    
    if (suppliesStocked === 'No') {
        checkboxContainer.style.display = 'block';
    } else {
        checkboxContainer.style.display = 'none';
        // Clear all checkboxes when hidden
        document.querySelectorAll('#supply-checkboxes input[type="checkbox"]').forEach(cb => cb.checked = false);
    }
}

// Handle vehicle return
async function handleReturn(e) {
    e.preventDefault();
    
    // Get selected supplies that need restocking
    let suppliesNeeded = [];
    if (document.getElementById('supplies-stocked').value === 'No') {
        document.querySelectorAll('#supply-checkboxes input[type="checkbox"]:checked').forEach(cb => {
            suppliesNeeded.push(cb.value);
        });
    }
    
    const formData = {
        vehicle_id: parseInt(document.getElementById('return-vehicle').value),
        return_mileage: parseInt(document.getElementById('return-mileage').value),
        fuel_level: parseInt(document.getElementById('fuel-level').value),
        supplies_stocked: document.getElementById('supplies-stocked').value,
        supplies_needed: suppliesNeeded.join(', '),
        condition_notes: document.getElementById('condition-notes').value,
        garage_level: document.getElementById('garage-level').value
    };
    
    try {
        const response = await fetch('/api/return', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('success', 'Vehicle returned successfully!', 'return-alert');
            document.getElementById('return-form').reset();
            loadVehicles();
            loadFleetStats();
        } else {
            showAlert('danger', result.error || 'An error occurred during return', 'return-alert');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('danger', 'An error occurred during return', 'return-alert');
    }
}

// Handle maintenance record
async function handleMaintenance(e) {
    e.preventDefault();
    
    const formData = {
        vehicle_id: parseInt(document.getElementById('maintenance-vehicle').value),
        maintenance_type: document.getElementById('maintenance-type').value,
        description: document.getElementById('maintenance-description').value,
        scheduled_date: document.getElementById('scheduled-date').value,
        set_maintenance_status: document.getElementById('set-maintenance-status').checked
    };
    
    try {
        const response = await fetch('/api/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('success', 'Maintenance scheduled successfully!', 'maintenance-alert');
            document.getElementById('maintenance-form').reset();
            loadVehicles();
            loadFleetStats();
            loadMaintenanceHistory();
        } else {
            showAlert('danger', result.error || 'An error occurred while scheduling maintenance', 'maintenance-alert');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('danger', 'An error occurred while adding maintenance record', 'maintenance-alert');
    }
}



// Load reports
async function loadReports() {
    try {
        // Load checkout reports
        const checkoutResponse = await fetch('/api/reports/checkouts');
        const checkouts = await checkoutResponse.json();
        displayCheckoutReport(checkouts);
        
        // Load maintenance reports
        const maintenanceResponse = await fetch('/api/reports/maintenance');
        const maintenance = await maintenanceResponse.json();
        displayMaintenanceReport(maintenance);
        
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// Display checkout report
function displayCheckoutReport(checkouts) {
    const tbody = document.querySelector('#checkout-table tbody');
    tbody.innerHTML = '';
    
    checkouts.forEach(checkout => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${checkout.vehicle_name}</td>
            <td>${checkout.driver_name}</td>
            <td>${checkout.purpose}</td>
            <td>${new Date(checkout.checkout_date).toLocaleDateString()}</td>
            <td>${checkout.return_date ? new Date(checkout.return_date).toLocaleDateString() : 'Not Returned'}</td>
            <td>${checkout.checkout_mileage}${checkout.return_mileage ? ' - ' + checkout.return_mileage : ''}</td>
            <td>${checkout.is_returned ? 'Returned' : 'Active'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Display maintenance report
function displayMaintenanceReport(maintenance) {
    const tbody = document.querySelector('#maintenance-table tbody');
    tbody.innerHTML = '';
    
    maintenance.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.vehicle_name}</td>
            <td>${record.maintenance_type}</td>
            <td>${record.description}</td>
            <td>${new Date(record.date_performed).toLocaleDateString()}</td>
            <td>${record.mileage.toLocaleString()}</td>
            <td>$${record.cost.toFixed(2)}</td>
            <td>${record.performed_by || 'N/A'}</td>
        `;
        tbody.appendChild(row);
    });
}

// Show specific report
function showReport(reportId) {
    document.querySelectorAll('.report-section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(reportId).style.display = 'block';
}

// Load maintenance history
async function loadMaintenanceHistory() {
    try {
        const response = await fetch('/api/reports/maintenance');
        const maintenance = await response.json();
        
        const tbody = document.querySelector('#maintenance-history-table tbody');
        tbody.innerHTML = '';
        
        maintenance.forEach(record => {
            const row = document.createElement('tr');
            const scheduledDate = record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : 'Not scheduled';
            const status = record.status || 'scheduled';
            const markCompleteButton = status === 'scheduled' ? 
                `<button class="btn btn-success" onclick="completeMaintenance(${record.id})">Mark Complete</button>` : 
                'Completed';
            
            row.innerHTML = `
                <td>${record.vehicle_name}</td>
                <td>${record.maintenance_type}</td>
                <td>${record.description}</td>
                <td>${scheduledDate}</td>
                <td><span class="status-${status}">${status.toUpperCase()}</span></td>
                <td>${markCompleteButton}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading maintenance history:', error);
    }
}

// Complete maintenance record
async function completeMaintenance(maintenanceId) {
    try {
        const response = await fetch(`/api/maintenance/${maintenanceId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showAlert('success', 'Maintenance marked as complete!', 'maintenance-alert');
            loadMaintenanceHistory();
            loadVehicles();
            loadFleetStats();
        } else {
            showAlert('danger', result.error || 'An error occurred while completing maintenance', 'maintenance-alert');
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('danger', 'An error occurred while completing maintenance', 'maintenance-alert');
    }
}

// Show alert message
function showAlert(type, message, containerId = null) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    
    const container = containerId ? document.getElementById(containerId) : document.body;
    
    if (containerId) {
        container.innerHTML = '';
        container.appendChild(alertDiv);
    } else {
        container.insertBefore(alertDiv, container.firstChild);
    }
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Report Generation Functions
function generateUtilizationReport() {
    const reportDiv = document.getElementById('report-display');
    
    // Calculate utilization metrics
    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter(v => v.status === 'available').length;
    const checkedOutVehicles = vehicles.filter(v => v.status === 'checked_out').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    
    const utilizationRate = totalVehicles > 0 ? ((checkedOutVehicles / totalVehicles) * 100).toFixed(1) : 0;
    const availabilityRate = totalVehicles > 0 ? ((availableVehicles / totalVehicles) * 100).toFixed(1) : 0;
    
    reportDiv.innerHTML = `
        <h3>📊 Vehicle Utilization Report</h3>
        <div class="report-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
            <div class="stat-card" style="background: #f8f9ff; padding: 20px; border-radius: 15px; text-align: center;">
                <h4>Total Fleet</h4>
                <div style="font-size: 2em; font-weight: bold; color: #667eea;">${totalVehicles}</div>
            </div>
            <div class="stat-card" style="background: #e8f5e8; padding: 20px; border-radius: 15px; text-align: center;">
                <h4>Available</h4>
                <div style="font-size: 2em; font-weight: bold; color: #2e7d32;">${availableVehicles}</div>
                <div style="color: #2e7d32;">${availabilityRate}%</div>
            </div>
            <div class="stat-card" style="background: #ffebee; padding: 20px; border-radius: 15px; text-align: center;">
                <h4>In Use</h4>
                <div style="font-size: 2em; font-weight: bold; color: #c62828;">${checkedOutVehicles}</div>
                <div style="color: #c62828;">${utilizationRate}%</div>
            </div>
            <div class="stat-card" style="background: #fff3e0; padding: 20px; border-radius: 15px; text-align: center;">
                <h4>Maintenance</h4>
                <div style="font-size: 2em; font-weight: bold; color: #ef6c00;">${maintenanceVehicles}</div>
            </div>
        </div>
        <table class="report-table" style="margin-top: 20px;">
            <thead>
                <tr>
                    <th>Vehicle</th>
                    <th>Status</th>
                    <th>Current Mileage</th>
                    <th>Location</th>
                </tr>
            </thead>
            <tbody>
                ${vehicles.map(vehicle => `
                    <tr>
                        <td>${vehicle.name}</td>
                        <td><span class="status-${vehicle.status}">${vehicle.status.toUpperCase()}</span></td>
                        <td>${vehicle.current_mileage.toLocaleString()}</td>
                        <td>${vehicle.location || 'Unknown'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function generateMaintenanceReport() {
    const reportDiv = document.getElementById('report-display');
    
    fetch('/api/reports/maintenance')
        .then(response => response.json())
        .then(maintenance => {
            const scheduledCount = maintenance.filter(m => m.status === 'scheduled').length;
            const completedCount = maintenance.filter(m => m.status === 'completed').length;
            
            reportDiv.innerHTML = `
                <h3>🔧 Maintenance Report</h3>
                <div class="report-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                    <div class="stat-card" style="background: #fff3e0; padding: 20px; border-radius: 15px; text-align: center;">
                        <h4>Scheduled</h4>
                        <div style="font-size: 2em; font-weight: bold; color: #ef6c00;">${scheduledCount}</div>
                    </div>
                    <div class="stat-card" style="background: #e8f5e8; padding: 20px; border-radius: 15px; text-align: center;">
                        <h4>Completed</h4>
                        <div style="font-size: 2em; font-weight: bold; color: #2e7d32;">${completedCount}</div>
                    </div>
                </div>
                <table class="report-table" style="margin-top: 20px;">
                    <thead>
                        <tr>
                            <th>Vehicle</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Scheduled Date</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${maintenance.map(record => `
                            <tr>
                                <td>${record.vehicle_name}</td>
                                <td>${record.maintenance_type}</td>
                                <td>${record.description}</td>
                                <td>${record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : 'Not scheduled'}</td>
                                <td><span class="status-${record.status}">${record.status.toUpperCase()}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(error => {
            console.error('Error loading maintenance report:', error);
            reportDiv.innerHTML = '<p>Error loading maintenance report.</p>';
        });
}

function generateEfficiencyReport() {
    const reportDiv = document.getElementById('report-display');
    
    fetch('/api/reports/checkouts')
        .then(response => response.json())
        .then(checkouts => {
            const completedCheckouts = checkouts.filter(c => c.is_returned);
            const avgMilesDriven = completedCheckouts.length > 0 ? 
                (completedCheckouts.reduce((sum, c) => sum + (c.return_mileage - c.checkout_mileage), 0) / completedCheckouts.length).toFixed(1) : 0;
            
            const vehicleEfficiency = vehicles.map(vehicle => {
                const vehicleCheckouts = completedCheckouts.filter(c => c.vehicle_id === vehicle.id);
                const totalMiles = vehicleCheckouts.reduce((sum, c) => sum + (c.return_mileage - c.checkout_mileage), 0);
                const totalTrips = vehicleCheckouts.length;
                return {
                    name: vehicle.name,
                    trips: totalTrips,
                    totalMiles: totalMiles,
                    avgMiles: totalTrips > 0 ? (totalMiles / totalTrips).toFixed(1) : 0
                };
            });
            
            reportDiv.innerHTML = `
                <h3>⚡ Efficiency Report</h3>
                <div class="report-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0;">
                    <div class="stat-card" style="background: #e3f2fd; padding: 20px; border-radius: 15px; text-align: center;">
                        <h4>Total Checkouts</h4>
                        <div style="font-size: 2em; font-weight: bold; color: #1565c0;">${checkouts.length}</div>
                    </div>
                    <div class="stat-card" style="background: #f3e5f5; padding: 20px; border-radius: 15px; text-align: center;">
                        <h4>Avg Miles/Trip</h4>
                        <div style="font-size: 2em; font-weight: bold; color: #7b1fa2;">${avgMilesDriven}</div>
                    </div>
                </div>
                <table class="report-table" style="margin-top: 20px;">
                    <thead>
                        <tr>
                            <th>Vehicle</th>
                            <th>Total Trips</th>
                            <th>Total Miles</th>
                            <th>Avg Miles/Trip</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vehicleEfficiency.map(vehicle => `
                            <tr>
                                <td>${vehicle.name}</td>
                                <td>${vehicle.trips}</td>
                                <td>${vehicle.totalMiles.toLocaleString()}</td>
                                <td>${vehicle.avgMiles}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        })
        .catch(error => {
            console.error('Error loading efficiency report:', error);
            reportDiv.innerHTML = '<p>Error loading efficiency report.</p>';
        });
}

// Export Functions
function exportToCSV(dataType) {
    const timestamp = new Date().toISOString().split('T')[0];
    let csvContent = '';
    let filename = '';
    
    switch (dataType) {
        case 'vehicles':
            csvContent = generateVehicleCSV();
            filename = `vehicles_${timestamp}.csv`;
            break;
        case 'checkout-history':
            generateCheckoutCSV().then(csv => {
                downloadCSV(csv, `checkout_history_${timestamp}.csv`);
            });
            return;
        case 'maintenance':
            generateMaintenanceCSV().then(csv => {
                downloadCSV(csv, `maintenance_${timestamp}.csv`);
            });
            return;
        case 'utilization':
            csvContent = generateUtilizationCSV();
            filename = `utilization_report_${timestamp}.csv`;
            break;
        default:
            generateCompleteCSV().then(csv => {
                downloadCSV(csv, `complete_report_${timestamp}.csv`);
            });
            return;
    }
    
    downloadCSV(csvContent, filename);
}

function generateVehicleCSV() {
    const headers = ['Name', 'Make', 'Model', 'Year', 'License Plate', 'VIN', 'Current Mileage', 'Status', 'Location', 'Garage Level'];
    const rows = vehicles.map(vehicle => [
        vehicle.name,
        vehicle.make,
        vehicle.model,
        vehicle.year,
        vehicle.license_plate,
        vehicle.vin,
        vehicle.current_mileage,
        vehicle.status,
        vehicle.location || '',
        vehicle.garage_level || ''
    ]);
    
    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

async function generateCheckoutCSV() {
    const response = await fetch('/api/reports/checkouts');
    const checkouts = await response.json();
    
    const headers = ['Vehicle', 'Driver', 'Purpose', 'Checkout Date', 'Return Date', 'Checkout Mileage', 'Return Mileage', 'Miles Driven', 'Status'];
    const rows = checkouts.map(checkout => [
        checkout.vehicle_name || 'Unknown',
        checkout.driver_name,
        checkout.purpose,
        new Date(checkout.checkout_date).toLocaleDateString(),
        checkout.return_date ? new Date(checkout.return_date).toLocaleDateString() : 'Not returned',
        checkout.checkout_mileage,
        checkout.return_mileage || '',
        checkout.return_mileage ? (checkout.return_mileage - checkout.checkout_mileage) : '',
        checkout.is_returned ? 'Returned' : 'Checked Out'
    ]);
    
    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

async function generateMaintenanceCSV() {
    const response = await fetch('/api/reports/maintenance');
    const maintenance = await response.json();
    
    const headers = ['Vehicle', 'Type', 'Description', 'Scheduled Date', 'Status', 'Completed Date'];
    const rows = maintenance.map(record => [
        record.vehicle_name || 'Unknown',
        record.maintenance_type,
        record.description,
        record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : '',
        record.status,
        record.completed_date ? new Date(record.completed_date).toLocaleDateString() : ''
    ]);
    
    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

function generateUtilizationCSV() {
    const headers = ['Metric', 'Value'];
    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter(v => v.status === 'available').length;
    const checkedOutVehicles = vehicles.filter(v => v.status === 'checked_out').length;
    const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    
    const rows = [
        ['Total Vehicles', totalVehicles],
        ['Available Vehicles', availableVehicles],
        ['Checked Out Vehicles', checkedOutVehicles],
        ['Maintenance Vehicles', maintenanceVehicles],
        ['Utilization Rate (%)', totalVehicles > 0 ? ((checkedOutVehicles / totalVehicles) * 100).toFixed(1) : 0],
        ['Availability Rate (%)', totalVehicles > 0 ? ((availableVehicles / totalVehicles) * 100).toFixed(1) : 0]
    ];
    
    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
}

async function generateCompleteCSV() {
    const vehicleCSV = generateVehicleCSV();
    const checkoutCSV = await generateCheckoutCSV();
    const maintenanceCSV = await generateMaintenanceCSV();
    const utilizationCSV = generateUtilizationCSV();
    
    return `VEHICLES\n${vehicleCSV}\n\nCHECKOUT HISTORY\n${checkoutCSV}\n\nMAINTENANCE\n${maintenanceCSV}\n\nUTILIZATION\n${utilizationCSV}`;
}

function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function exportToJSON(dataType) {
    const timestamp = new Date().toISOString().split('T')[0];
    let jsonData = {};
    let filename = '';
    
    switch (dataType) {
        case 'vehicles':
            jsonData = { vehicles: vehicles };
            filename = `vehicles_${timestamp}.json`;
            break;
        case 'checkout-history':
            fetch('/api/reports/checkouts')
                .then(response => response.json())
                .then(checkouts => {
                    downloadJSON({ checkout_history: checkouts }, `checkout_history_${timestamp}.json`);
                });
            return;
        case 'maintenance':
            fetch('/api/reports/maintenance')
                .then(response => response.json())
                .then(maintenance => {
                    downloadJSON({ maintenance: maintenance }, `maintenance_${timestamp}.json`);
                });
            return;
        case 'utilization':
            const totalVehicles = vehicles.length;
            const availableVehicles = vehicles.filter(v => v.status === 'available').length;
            const checkedOutVehicles = vehicles.filter(v => v.status === 'checked_out').length;
            const maintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
            
            jsonData = {
                utilization_report: {
                    timestamp: new Date().toISOString(),
                    total_vehicles: totalVehicles,
                    available_vehicles: availableVehicles,
                    checked_out_vehicles: checkedOutVehicles,
                    maintenance_vehicles: maintenanceVehicles,
                    utilization_rate: totalVehicles > 0 ? ((checkedOutVehicles / totalVehicles) * 100).toFixed(1) : 0,
                    availability_rate: totalVehicles > 0 ? ((availableVehicles / totalVehicles) * 100).toFixed(1) : 0,
                    vehicles: vehicles
                }
            };
            filename = `utilization_report_${timestamp}.json`;
            break;
        default:
            Promise.all([
                fetch('/api/reports/checkouts').then(r => r.json()),
                fetch('/api/reports/maintenance').then(r => r.json())
            ]).then(([checkouts, maintenance]) => {
                const completeData = {
                    export_timestamp: new Date().toISOString(),
                    vehicles: vehicles,
                    checkout_history: checkouts,
                    maintenance: maintenance,
                    fleet_stats: {
                        total_vehicles: vehicles.length,
                        available: vehicles.filter(v => v.status === 'available').length,
                        checked_out: vehicles.filter(v => v.status === 'checked_out').length,
                        maintenance: vehicles.filter(v => v.status === 'maintenance').length
                    }
                };
                downloadJSON(completeData, `complete_dataset_${timestamp}.json`);
            });
            return;
    }
    
    downloadJSON(jsonData, filename);
}

function downloadJSON(jsonData, filename) {
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Excel export function (fallback to CSV)
function exportToExcel(dataType) {
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (dataType === 'complete') {
        // Create workbook with multiple sheets
        createCompleteExcelWorkbook(timestamp);
    } else {
        // Create single sheet Excel file
        createSingleSheetExcel(dataType, timestamp);
    }
}

async function createCompleteExcelWorkbook(timestamp) {
    try {
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Sheet 1: Vehicle Inventory
        const vehicleData = await fetch('/api/vehicles').then(r => r.json());
        const vehicleWS = XLSX.utils.json_to_sheet(vehicleData.map(v => ({
            'Vehicle Name': v.name,
            'Make': v.make,
            'Model': v.model,
            'Year': v.year,
            'License Plate': v.license_plate,
            'VIN': v.vin,
            'Current Mileage': v.current_mileage,
            'Status': v.status,
            'Access Level': v.access_level,
            'Location': v.location || '',
            'Garage Level': v.garage_level || ''
        })));
        XLSX.utils.book_append_sheet(wb, vehicleWS, "Vehicle Inventory");
        
        // Sheet 2: Checkout History
        const checkoutData = await fetch('/api/reports/checkouts').then(r => r.json());
        const checkoutWS = XLSX.utils.json_to_sheet(checkoutData.map(c => ({
            'Vehicle': c.vehicle_name || 'Unknown',
            'Driver': c.driver_name,
            'Purpose': c.purpose,
            'Checkout Date': new Date(c.checkout_date).toLocaleDateString(),
            'Return Date': c.return_date ? new Date(c.return_date).toLocaleDateString() : 'Not returned',
            'Checkout Mileage': c.checkout_mileage,
            'Return Mileage': c.return_mileage || '',
            'Miles Driven': c.return_mileage ? (c.return_mileage - c.checkout_mileage) : '',
            'Fuel Level': c.fuel_level || '',
            'Supplies Stocked': c.supplies_stocked || '',
            'Condition Notes': c.condition_notes || '',
            'Status': c.is_returned ? 'Returned' : 'Checked Out'
        })));
        XLSX.utils.book_append_sheet(wb, checkoutWS, "Checkout History");
        
        // Sheet 3: Maintenance Records
        const maintenanceData = await fetch('/api/reports/maintenance').then(r => r.json());
        const maintenanceWS = XLSX.utils.json_to_sheet(maintenanceData.map(m => ({
            'Vehicle': m.vehicle_name || 'Unknown',
            'Maintenance Type': m.maintenance_type,
            'Description': m.description,
            'Scheduled Date': m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '',
            'Status': m.status,
            'Completed Date': m.completed_date ? new Date(m.completed_date).toLocaleDateString() : '',
            'Cost': m.cost || 0,
            'Performed By': m.performed_by || '',
            'Next Due Date': m.next_due_date ? new Date(m.next_due_date).toLocaleDateString() : ''
        })));
        XLSX.utils.book_append_sheet(wb, maintenanceWS, "Maintenance Records");
        
        // Sheet 4: Fleet Utilization
        const fleetStats = await fetch('/api/fleet-stats').then(r => r.json());
        const utilizationData = [
            { 'Metric': 'Total Vehicles', 'Value': fleetStats.total_vehicles },
            { 'Metric': 'Available Vehicles', 'Value': fleetStats.available },
            { 'Metric': 'Checked Out Vehicles', 'Value': fleetStats.checked_out },
            { 'Metric': 'Maintenance Vehicles', 'Value': fleetStats.maintenance },
            { 'Metric': 'Reserved Vehicles', 'Value': fleetStats.reserved || 0 },
            { 'Metric': 'Utilization Rate (%)', 'Value': fleetStats.total_vehicles > 0 ? ((fleetStats.checked_out / fleetStats.total_vehicles) * 100).toFixed(1) : 0 },
            { 'Metric': 'Availability Rate (%)', 'Value': fleetStats.total_vehicles > 0 ? ((fleetStats.available / fleetStats.total_vehicles) * 100).toFixed(1) : 0 }
        ];
        const utilizationWS = XLSX.utils.json_to_sheet(utilizationData);
        XLSX.utils.book_append_sheet(wb, utilizationWS, "Fleet Utilization");
        
        // Write the workbook
        XLSX.writeFile(wb, `VAULT_Complete_Workbook_${timestamp}.xlsx`);
        showAlert('success', 'Complete Excel workbook exported with 4 separate tabs!');
        
    } catch (error) {
        console.error('Error creating Excel workbook:', error);
        showAlert('danger', 'Error creating Excel workbook. Please try again.');
    }
}

async function createSingleSheetExcel(dataType, timestamp) {
    try {
        let data = [];
        let filename = '';
        let sheetName = '';
        
        switch (dataType) {
            case 'vehicles':
                data = await fetch('/api/vehicles').then(r => r.json());
                data = data.map(v => ({
                    'Vehicle Name': v.name,
                    'Make': v.make,
                    'Model': v.model,
                    'Year': v.year,
                    'License Plate': v.license_plate,
                    'Current Mileage': v.current_mileage,
                    'Status': v.status,
                    'Location': v.location || ''
                }));
                filename = `vehicles_${timestamp}.xlsx`;
                sheetName = 'Vehicles';
                break;
                
            case 'checkout-history':
                data = await fetch('/api/reports/checkouts').then(r => r.json());
                data = data.map(c => ({
                    'Vehicle': c.vehicle_name || 'Unknown',
                    'Driver': c.driver_name,
                    'Purpose': c.purpose,
                    'Checkout Date': new Date(c.checkout_date).toLocaleDateString(),
                    'Return Date': c.return_date ? new Date(c.return_date).toLocaleDateString() : 'Not returned',
                    'Miles Driven': c.return_mileage ? (c.return_mileage - c.checkout_mileage) : '',
                    'Status': c.is_returned ? 'Returned' : 'Checked Out'
                }));
                filename = `checkout_history_${timestamp}.xlsx`;
                sheetName = 'Checkout History';
                break;
                
            case 'maintenance':
                data = await fetch('/api/reports/maintenance').then(r => r.json());
                data = data.map(m => ({
                    'Vehicle': m.vehicle_name || 'Unknown',
                    'Type': m.maintenance_type,
                    'Description': m.description,
                    'Scheduled Date': m.scheduled_date ? new Date(m.scheduled_date).toLocaleDateString() : '',
                    'Status': m.status
                }));
                filename = `maintenance_${timestamp}.xlsx`;
                sheetName = 'Maintenance';
                break;
                
            case 'utilization':
                const fleetStats = await fetch('/api/fleet-stats').then(r => r.json());
                data = [
                    { 'Metric': 'Total Vehicles', 'Value': fleetStats.total_vehicles },
                    { 'Metric': 'Available', 'Value': fleetStats.available },
                    { 'Metric': 'Checked Out', 'Value': fleetStats.checked_out },
                    { 'Metric': 'Maintenance', 'Value': fleetStats.maintenance },
                    { 'Metric': 'Utilization Rate (%)', 'Value': fleetStats.total_vehicles > 0 ? ((fleetStats.checked_out / fleetStats.total_vehicles) * 100).toFixed(1) : 0 }
                ];
                filename = `utilization_report_${timestamp}.xlsx`;
                sheetName = 'Utilization Report';
                break;
        }
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        XLSX.writeFile(wb, filename);
        showAlert('success', `${sheetName} exported to Excel successfully!`);
        
    } catch (error) {
        console.error('Error creating Excel file:', error);
        showAlert('danger', 'Error creating Excel file. Please try again.');
    }
}

// Auto-populate mileage and handle access control when vehicle is selected
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('checkout-vehicle').addEventListener('change', function() {
        const vehicleId = parseInt(this.value);
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const pinInputGroup = document.getElementById('pin-input-group');
        const pinInput = document.getElementById('management-pin');
        
        if (vehicle) {
            document.getElementById('mileage-out').value = vehicle.current_mileage;
            
            // Show PIN input for management vehicles
            if (vehicle.access_level === 'management') {
                pinInputGroup.style.display = 'block';
                pinInput.required = true;
            } else {
                pinInputGroup.style.display = 'none';
                pinInput.required = false;
                pinInput.value = '';
            }
        } else {
            pinInputGroup.style.display = 'none';
            pinInput.required = false;
            pinInput.value = '';
        }
    });
});
