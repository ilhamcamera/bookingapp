// Konfigurasi Aplikasi
const CONFIG = {
    googleScriptUrl: 'https://script.google.com/macros/s/AKfycbwWIKTZnSBK2Rs2kNAhmth5E8yE_5wZoZ-RW5EjXvPLqcQhIl7HgIvn81u0xfJ-w19P/exec',
    unitsJsonPath: 'units.json'
};

// State Aplikasi
const state = {
    bookingData: {},
    units: [],
    categories: [],
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear()
};

// Cache DOM Elements
const elements = {
    bookingMatrix: document.getElementById('bookingMatrix'),
    dateHeaderRow: document.getElementById('dateHeaderRow'),
    matrixBody: document.getElementById('matrixBody'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    filterCategory: document.getElementById('filterCategory'),
    filterUnit: document.getElementById('filterUnit'),
    filterMonth: document.getElementById('filterMonth'),
    filterYear: document.getElementById('filterYear')
};

// Utility Functions
const utils = {
    /**
     * Format date to YYYY-MM-DD
     * @param {Date} date - Date object to format
     * @returns {string} Formatted date string
     */
    formatDate: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * Check if date is weekend
     * @param {Date} date - Date to check
     * @returns {boolean} True if weekend
     */
    isWeekend: (date) => [0, 6].includes(date.getDay()),

    /**
     * Check if date is today
     * @param {Date} date - Date to check
     * @returns {boolean} True if today
     */
    isToday: (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    },

    /**
     * Get number of days in month
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @returns {number} Days in month
     */
    getDaysInMonth: (year, month) => new Date(year, month + 1, 0).getDate(),

    /**
     * Debounce function to limit rapid calls
     * @param {Function} func - Function to debounce
     * @param {number} delay - Delay in ms
     * @returns {Function} Debounced function
     */
    debounce: (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    },

    /**
     * Calculate optimal cell width based on container
     * @returns {number} Calculated cell width
     */
    calculateCellWidth: () => {
        const containerWidth = document.querySelector('.container').clientWidth;
        const daysInMonth = utils.getDaysInMonth(state.currentYear, state.currentMonth);
        const unitColumnWidth = 200;
        const minCellWidth = 45;
        const availableWidth = containerWidth - unitColumnWidth - 40;
        
        return Math.max(minCellWidth, Math.floor(availableWidth / daysInMonth));
    }
};

// Core Functions
const core = {
    /**
     * Load units data from JSON file
     * @returns {Promise} Promise with units data
     */
    loadUnits: async () => {
        try {
            const response = await fetch(CONFIG.unitsJsonPath);
            if (!response.ok) throw new Error('Failed to load units');
            
            const data = await response.json();
            state.units = data.units || [];
            state.categories = data.categories || [];
            return { units: state.units, categories: state.categories };
        } catch (error) {
            console.error('Error loading units:', error);
            throw error;
        }
    },

    /**
     * Load booking data from Google Apps Script
     * @returns {Promise} Promise with booking data
     */
    loadBookingData: async () => {
        elements.loadingIndicator.style.display = 'flex';
        
        try {
            const timestamp = Date.now();
            const url = `${CONFIG.googleScriptUrl}?action=getBookings&month=${state.currentMonth + 1}&year=${state.currentYear}&t=${timestamp}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load data');
            
            const data = await response.json();
            if (!data?.success) throw new Error(data?.message || 'Invalid data');
            
            state.bookingData = data.data || {};
            core.generateMatrix();
        } catch (error) {
            console.error('Error:', error);
            elements.matrixBody.innerHTML = `<tr><td colspan="100%">Error loading data</td></tr>`;
        } finally {
            elements.loadingIndicator.style.display = 'none';
        }
    },

    /**
     * Generate date headers for the matrix
     */
    generateDateHeaders: () => {
        elements.dateHeaderRow.innerHTML = '<th class="unit-header">Barang</th>';
        
        const daysInMonth = utils.getDaysInMonth(state.currentYear, state.currentMonth);
        const cellWidth = utils.calculateCellWidth();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(state.currentYear, state.currentMonth, day);
            const th = document.createElement('th');
            th.classList.add('date-header');
            if (utils.isWeekend(date)) th.classList.add('weekend');
            if (utils.isToday(date)) th.classList.add('today');
            
            th.textContent = day;
            th.style.minWidth = `${cellWidth}px`;
            elements.dateHeaderRow.appendChild(th);
        }
    },

    /**
     * Generate the booking matrix
     */
    generateMatrix: () => {
        core.generateDateHeaders();
        elements.matrixBody.innerHTML = '';
        
        const selectedCategory = elements.filterCategory.value;
        const filteredUnits = selectedCategory === 'Semua' 
            ? state.units 
            : state.units.filter(unit => unit.category === selectedCategory);
        
        const cellWidth = utils.calculateCellWidth();
        
        filteredUnits.forEach(unit => {
            const row = document.createElement('tr');
            const unitCell = document.createElement('td');
            unitCell.textContent = unit.name;
            unitCell.classList.add('unit-cell');
            row.appendChild(unitCell);
            
            const daysInMonth = utils.getDaysInMonth(state.currentYear, state.currentMonth);
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(state.currentYear, state.currentMonth, day);
                const dateStr = utils.formatDate(date);
                const unitDateKey = `${unit.name}_${dateStr}`;
                
                const cell = document.createElement('td');
                cell.classList.add('date-cell');
                if (utils.isWeekend(date)) cell.classList.add('weekend');
                if (utils.isToday(date)) cell.classList.add('today');
                
                // Set dynamic width
                cell.style.minWidth = `${cellWidth}px`;
                
                // Reset status classes
                cell.classList.remove('available', 'booked');
                
                // Apply status
                if (state.bookingData[unitDateKey]?.status === 'booked') {
                    cell.classList.add('booked');
                } else {
                    cell.classList.add('available');
                }
                
                row.appendChild(cell);
            }
            elements.matrixBody.appendChild(row);
        });
    },

    /**
     * Populate filter dropdowns
     */
    populateFilters: () => {
        // Populate category filter
        elements.filterCategory.innerHTML = '<option value="Semua">Semua</option>';
        state.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            elements.filterCategory.appendChild(option);
        });

        // Populate year filter (current year -2 to +3)
        const currentYear = new Date().getFullYear();
        elements.filterYear.innerHTML = '';
        for (let year = currentYear - 2; year <= currentYear + 3; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === state.currentYear) option.selected = true;
            elements.filterYear.appendChild(option);
        }

        // Set current month
        elements.filterMonth.value = state.currentMonth;
    }
};

// Event Handlers
const handlers = {
    /**
     * Handle filter changes (month/year)
     */
    onFilterChange: () => {
        state.currentMonth = parseInt(elements.filterMonth.value);
        state.currentYear = parseInt(elements.filterYear.value);
        core.loadBookingData();
    },

    /**
     * Handle category filter change
     */
    onCategoryChange: () => {
        // Update unit filter based on selected category
        elements.filterUnit.innerHTML = '<option value="all">Semua Barang</option>';
        const selectedCategory = elements.filterCategory.value;
        const filteredUnits = selectedCategory === 'Semua' 
            ? state.units 
            : state.units.filter(unit => unit.category === selectedCategory);
            
        filteredUnits.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.name;
            option.textContent = unit.name;
            elements.filterUnit.appendChild(option);
        });

        core.generateMatrix();
    }
};

// Initialize Application
const init = async () => {
    try {
        elements.loadingIndicator.style.display = 'flex';
        await core.loadUnits();
        core.populateFilters();
        await core.loadBookingData();
    } finally {
        elements.loadingIndicator.style.display = 'none';
    }
    
    // Set up event listeners
    elements.filterCategory.addEventListener('change', handlers.onCategoryChange);
    elements.filterMonth.addEventListener('change', handlers.onFilterChange);
    elements.filterYear.addEventListener('change', handlers.onFilterChange);
    elements.filterUnit.addEventListener('change', core.generateMatrix);

    // Handle window resize
    window.addEventListener('resize', utils.debounce(core.generateMatrix, 300));
};

// Start the application
document.addEventListener('DOMContentLoaded', init);