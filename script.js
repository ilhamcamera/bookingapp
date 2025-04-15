// Konfigurasi Aplikasi
const CONFIG = {
    googleScriptUrl: 'https://script.google.com/macros/s/AKfycbx8Ys03XP2VU_Jc-hrkg2tqx6ARzXsV5LndosC4zLvVYq7FteoihxLKIVauYFSc-HAz/exec',
    unitsJsonPath: 'units.json'
};

// State Aplikasi
const state = {
    bookingData: {},
    units: [],
    categories: [],
    selectedUnit: null,
    selectedDate: null,
    currentMonth: new Date().getMonth(),
    currentYear: new Date().getFullYear(),
    bookingModal: null
};

// Cache DOM Elements
const elements = {
    bookingMatrix: document.getElementById('bookingMatrix'),
    dateHeaderRow: document.getElementById('dateHeaderRow'),
    matrixBody: document.getElementById('matrixBody'),
    monthYearDisplay: document.getElementById('monthYearDisplay'),
    prevMonthBtn: document.getElementById('prevMonth'),
    nextMonthBtn: document.getElementById('nextMonth'),
    refreshBtn: document.getElementById('refreshBtn'),
    lastUpdated: document.getElementById('lastUpdated'),
    bookingModalElem: document.getElementById('bookingModal'),
    bookingDateElem: document.getElementById('bookingDate'),
    bookingUnitElem: document.getElementById('bookingUnit'),
    bookingDescription: document.getElementById('bookingDescription'),
    bookingStatus: document.getElementById('bookingStatus'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    filterStatus: document.getElementById('filterStatus'),
    filterUnit: document.getElementById('filterUnit'),
    filterCategory: document.getElementById('filterCategory'),
    tableContainer: document.querySelector('.table-container')
};

// Utility Functions
const utils = {
    formatDate: (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    parseDate: (dateStr) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
    },

    formatDisplayDate: (date) => {
        return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
    },

    formatFullDate: (dateStr) => {
        const date = utils.parseDate(dateStr);
        return date.toLocaleDateString('id-ID', { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
        });
    },

    isWeekend: (date) => [0, 6].includes(date.getDay()),

    isToday: (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    },

    getDaysInMonth: (year, month) => new Date(year, month + 1, 0).getDate(),

    debounce: (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    },

    calculateCellWidth: () => {
        const containerWidth = document.querySelector('.container').clientWidth;
        const daysInMonth = utils.getDaysInMonth(state.currentYear, state.currentMonth);
        const unitColumnWidth = 180;
        const minCellWidth = 40;
        const availableWidth = containerWidth - unitColumnWidth - 40;
        
        return Math.max(minCellWidth, Math.floor(availableWidth / daysInMonth));
    },
    
    isMobileDevice: () => {
        return window.innerWidth <= 768 || 
               /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }
};

// Core Functions
const core = {
    loadUnits: async () => {
        try {
            const response = await fetch(CONFIG.unitsJsonPath);
            if (!response.ok) throw new Error('Failed to load units.json');
            
            const data = await response.json();
            
            // Handle duplicate names by adding index
            const nameCount = {};
            const processedUnits = [];
            
            data.units.forEach(unit => {
                nameCount[unit.name] = (nameCount[unit.name] || 0) + 1;
            });
            
            const nameIndex = {};
            data.units.forEach(unit => {
                let displayName = unit.name;
                if (nameCount[unit.name] > 1) {
                    nameIndex[unit.name] = (nameIndex[unit.name] || 0) + 1;
                    displayName = `${unit.name} (${nameIndex[unit.name]})`;
                }
                
                processedUnits.push({
                    originalName: unit.name,
                    displayName: displayName,
                    category: unit.category
                });
            });
            
            state.units = processedUnits;
            state.categories = data.categories;
            return { units: state.units, categories: state.categories };
        } catch (error) {
            console.error('Error loading units:', error);
            throw error;
        }
    },

    loadBookingData: async () => {
        elements.loadingIndicator.style.display = 'flex';
        elements.matrixBody.innerHTML = '<tr><td colspan="100%">Memuat data...</td></tr>';
        
        try {
            const timestamp = Date.now();
            const url = `${CONFIG.googleScriptUrl}?action=getBookings&month=${state.currentMonth + 1}&year=${state.currentYear}&t=${timestamp}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Gagal memuat data');
            
            const data = await response.json();
            if (!data?.success) throw new Error(data?.message || 'Format data tidak valid');
            
            // Normalize booking data
            state.bookingData = {};
            Object.entries(data.data).forEach(([key, value]) => {
                if (value) {
                    state.bookingData[key] = {
                        date: value.date,
                        unit: value.unit,
                        description: value.description || '',
                        status: value.status || 'available'
                    };
                }
            });
            
            elements.lastUpdated.textContent = new Date().toLocaleString('id-ID');
            core.generateMatrix();
        } catch (error) {
            console.error('Error:', error);
            elements.matrixBody.innerHTML = `<tr><td colspan="100%">Error: ${error.message}</td></tr>`;
        } finally {
            elements.loadingIndicator.style.display = 'none';
        }
    },

    generateDateHeaders: () => {
        while (elements.dateHeaderRow.children.length > 1) {
            elements.dateHeaderRow.removeChild(elements.dateHeaderRow.lastChild);
        }
        
        const daysInMonth = utils.getDaysInMonth(state.currentYear, state.currentMonth);
        const cellWidth = utils.calculateCellWidth();
        
        // Tambahkan kelas untuk menyesuaikan lebar berdasarkan jumlah hari
        elements.tableContainer.classList.remove('days-28', 'days-30', 'days-31');
        if (daysInMonth === 28) {
            elements.tableContainer.classList.add('days-28');
        } else if (daysInMonth === 30) {
            elements.tableContainer.classList.add('days-30');
        } else {
            elements.tableContainer.classList.add('days-31');
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(state.currentYear, state.currentMonth, day);
            const dateStr = utils.formatDate(date);
            
            const th = document.createElement('th');
            th.classList.add('date-header');
            if (utils.isWeekend(date)) th.classList.add('weekend');
            if (utils.isToday(date)) th.classList.add('today');
            
            th.textContent = day;
            th.dataset.date = dateStr;
            th.style.minWidth = `${cellWidth}px`;
            elements.dateHeaderRow.appendChild(th);
        }
    },

    generateMatrix: () => {
        const monthName = new Date(state.currentYear, state.currentMonth, 1)
            .toLocaleString('id-ID', { month: 'long' });
        elements.monthYearDisplay.textContent = `${monthName} ${state.currentYear}`;
        
        core.generateDateHeaders();
        elements.matrixBody.innerHTML = '';
        
        const selectedCategory = elements.filterCategory.value;
        const selectedUnitDisplayName = elements.filterUnit.selectedOptions[0]?.dataset.displayName;
        const selectedStatus = elements.filterStatus.value;
        
        // Apply filters
        let filteredUnits = state.units;
        
        if (selectedCategory !== 'Semua') {
            filteredUnits = filteredUnits.filter(unit => unit.category === selectedCategory);
        }
        
        if (selectedUnitDisplayName && selectedUnitDisplayName !== 'all') {
            filteredUnits = filteredUnits.filter(unit => unit.displayName === selectedUnitDisplayName);
        }
        
        filteredUnits.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        const cellWidth = utils.calculateCellWidth();
        
        filteredUnits.forEach(unit => {
            const row = document.createElement('tr');
            const unitCell = document.createElement('td');
            unitCell.textContent = unit.displayName;
            unitCell.classList.add('unit-cell');
            row.appendChild(unitCell);
            
            const daysInMonth = utils.getDaysInMonth(state.currentYear, state.currentMonth);
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(state.currentYear, state.currentMonth, day);
                const dateStr = utils.formatDate(date);
                const unitDateKey = `${unit.originalName}_${dateStr}`;
                
                const cell = document.createElement('td');
                cell.classList.add('date-cell');
                if (utils.isWeekend(date)) cell.classList.add('weekend');
                if (utils.isToday(date)) cell.classList.add('today');
                
                cell.style.minWidth = `${cellWidth}px`;
                cell.classList.remove('available', 'booked');
                
                // Process booking data
                const booking = state.bookingData[unitDateKey];
                const description = booking?.description || '';
                
                if (booking && (selectedStatus === 'all' || booking.status === selectedStatus)) {
                    cell.classList.add(booking.status);
                    if (description) {
                        cell.innerHTML = `<div class="description" title="${description}"><small>${description}</small></div>`;
                    }
                } else if (!booking && (selectedStatus === 'all' || selectedStatus === 'available')) {
                    cell.classList.add('available');
                    if (description) {
                        cell.innerHTML = `<div class="description" title="${description}"><small>${description}</small></div>`;
                    }
                }
                
                cell.dataset.unit = unit.originalName;
                cell.dataset.date = dateStr;
                cell.addEventListener('click', () => core.openBookingModal(unit.originalName, dateStr));
                row.appendChild(cell);
            }
            elements.matrixBody.appendChild(row);
        });
    },

    populateCategoryFilter: () => {
        elements.filterCategory.innerHTML = '<option value="Semua">Semua</option>';
        state.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            elements.filterCategory.appendChild(option);
        });
    },

    populateUnitFilter: () => {
        const selectedCategory = elements.filterCategory.value;
        elements.filterUnit.innerHTML = '<option value="all" data-display-name="all">Semua Barang</option>';
        
        const unitsToShow = selectedCategory === 'Semua' 
            ? state.units 
            : state.units.filter(unit => unit.category === selectedCategory);
        
        unitsToShow.sort((a, b) => a.displayName.localeCompare(b.displayName));
        
        unitsToShow.forEach(unit => {
            const option = document.createElement('option');
            option.value = unit.originalName;
            option.textContent = unit.displayName;
            option.dataset.displayName = unit.displayName;
            elements.filterUnit.appendChild(option);
        });
    },

    openBookingModal: (unit, dateStr) => {
        state.selectedUnit = unit;
        state.selectedDate = dateStr;
        const unitDateKey = `${unit}_${dateStr}`;
        const booking = state.bookingData[unitDateKey];
        
        elements.bookingUnitElem.textContent = unit;
        elements.bookingDateElem.textContent = utils.formatFullDate(dateStr);
        
        if (booking) {
            elements.bookingDescription.textContent = booking.description || '-';
            elements.bookingStatus.textContent = booking.status === 'booked' ? 'Terbooking' : 'Tersedia';
        } else {
            elements.bookingDescription.textContent = '-';
            elements.bookingStatus.textContent = 'Tersedia';
        }
        
        state.bookingModal.show();
    },

    handleWindowResize: utils.debounce(() => {
        if (elements.matrixBody.children.length > 0) {
            core.generateMatrix();
        }
    }, 300)
};

// Event Handlers
const handlers = {
    onPrevMonth: () => {
        state.currentMonth--;
        if (state.currentMonth < 0) {
            state.currentMonth = 11;
            state.currentYear--;
        }
        core.loadBookingData();
    },

    onNextMonth: () => {
        state.currentMonth++;
        if (state.currentMonth > 11) {
            state.currentMonth = 0;
            state.currentYear++;
        }
        core.loadBookingData();
    },

    onRefresh: async () => {
        try {
            elements.loadingIndicator.style.display = 'flex';
            await core.loadUnits();
            core.populateCategoryFilter();
            core.populateUnitFilter();
            await core.loadBookingData();
        } finally {
            elements.loadingIndicator.style.display = 'none';
        }
    },

    onCategoryChange: () => {
        core.populateUnitFilter();
        core.generateMatrix();
    }
};

// Initialize Application
const init = async () => {
    state.bookingModal = new bootstrap.Modal(elements.bookingModalElem);
    
    const now = new Date();
    state.currentMonth = now.getMonth();
    state.currentYear = now.getFullYear();
    
    try {
        elements.loadingIndicator.style.display = 'flex';
        await core.loadUnits();
        core.populateCategoryFilter();
        core.populateUnitFilter();
        await core.loadBookingData();
    } finally {
        elements.loadingIndicator.style.display = 'none';
    }
    
    elements.prevMonthBtn.addEventListener('click', handlers.onPrevMonth);
    elements.nextMonthBtn.addEventListener('click', handlers.onNextMonth);
    elements.refreshBtn.addEventListener('click', handlers.onRefresh);
    elements.filterStatus.addEventListener('change', core.generateMatrix);
    elements.filterCategory.addEventListener('change', handlers.onCategoryChange);
    elements.filterUnit.addEventListener('change', core.generateMatrix);
    
    elements.bookingModalElem.addEventListener('hidden.bs.modal', () => {
        elements.refreshBtn.focus();
    });
    
    window.addEventListener('resize', core.handleWindowResize);
    elements.lastUpdated.textContent = new Date().toLocaleString('id-ID');
};

document.addEventListener('DOMContentLoaded', init);