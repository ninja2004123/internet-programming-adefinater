// Configuration
const CONFIG = {
    DATA_URLS: [
        'https://raw.githubusercontent.com/sweko/internet-programming-adefinater/refs/heads/preparation/data/doctor-who-episodes-01-10.json',
        'https://raw.githubusercontent.com/sweko/internet-programming-adefinater/refs/heads/preparation/data/doctor-who-episodes-11-20.json',
        'https://raw.githubusercontent.com/sweko/internet-programming-adefinater/refs/heads/preparation/data/doctor-who-episodes-21-30.json',
        'https://raw.githubusercontent.com/sweko/internet-programming-adefinater/refs/heads/preparation/data/doctor-who-episodes-31-40.json',
        'https://raw.githubusercontent.com/sweko/internet-programming-adefinater/refs/heads/preparation/data/doctor-who-episodes-41-50.json',
        'https://raw.githubusercontent.com/sweko/internet-programming-adefinater/refs/heads/preparation/data/doctor-who-episodes-51-65.json'
    ],
    FALLBACK_URL: './doctor-who-episodes-full.json',
    DATE_FORMATS: {
        ISO: 'YYYY-MM-DD',
        UK: 'DD/MM/YYYY',
        LONG: 'MMMM DD, YYYY',
        YEAR: 'YYYY'
    },
    ERA_ORDER: ['Classic', 'Modern', 'Recent']
};

// State Management
let state = {
    episodes: [],          // Original data
    filtered: [],          // Filtered results
    loading: true,         // Loading state
    error: null,          // Error message
    sort: {
        field: 'rank',     // Current sort field
        ascending: true    // Sort direction
    },
    filters: {
        name: ''          // Current filter value
    }
};

// Initialize Application
async function init() {
    setupEventListeners();
    await loadEpisodes();
}

// Event Listeners Setup
function setupEventListeners() {
    // Set up sorting on column headers
    const headers = document.querySelectorAll('th[data-sort]');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const field = header.dataset.sort;
            
            // Toggle sort direction if clicking the same column
            if (field === state.sort.field) {
                state.sort.ascending = !state.sort.ascending;
            } else {
                state.sort.field = field;
                state.sort.ascending = true;
            }

            // Update sort indicators
            updateSortIndicators(header);
            
            // Sort and display
            sortEpisodes(field);
        });
    });

    // Set up name filter
    const nameFilter = document.getElementById('name-filter');
    nameFilter.addEventListener('input', (e) => {
        state.filters.name = e.target.value;
        filterEpisodes();
    });
}

// Update sort indicators in the UI
function updateSortIndicators(activeHeader) {
    // Remove existing sort classes
    document.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });

    // Add appropriate sort class
    activeHeader.classList.add(state.sort.ascending ? 'sort-asc' : 'sort-desc');
}

// Data Loading
async function loadEpisodes() {
    try {
        showLoading(true);
        
        // First try to load from multiple URLs
        try {
            const episodeParts = await Promise.all(
                CONFIG.DATA_URLS.map(url => 
                    fetch(url)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.json();
                        })
                )
            );
            
            // Extract episodes from each part and combine them
            state.episodes = episodeParts
                .flatMap(part => part.episodes) // Extract episodes array from each part
                .sort((a, b) => (a.rank || 0) - (b.rank || 0));
                
        } catch (fetchError) {
            console.warn('Failed to load from multiple URLs, falling back to local file:', fetchError);
            showError('Remote data load failed. Loading local backup...');
            
            // Fallback to local file after a short delay to show the message
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const response = await fetch(CONFIG.FALLBACK_URL);
            if (!response.ok) {
                throw new Error('Both remote and local data loads failed');
            }
            const data = await response.json();
            
            // Handle both array and {episodes: [...]} format
            state.episodes = Array.isArray(data) ? data : data.episodes || [];
            
            // Sort by rank regardless of source
            state.episodes.sort((a, b) => (a.rank || 0) - (b.rank || 0));
            
            showError('Successfully loaded from local backup'); // Show success message
            await new Promise(resolve => setTimeout(resolve, 1500)); // Show success message briefly
            showError(''); // Clear error message
        }

        // Initialize filtered episodes with all episodes
        state.filtered = [...state.episodes];
        
        // Display the episodes
        displayEpisodes(state.filtered);
        
    } catch (error) {
        showError(`Failed to load episodes: ${error.message}`);
        console.error('Error loading episodes:', error);
    } finally {
        showLoading(false);
    }
}

// Display Functions
function displayEpisodes(episodes) {
    const tbody = document.getElementById('episodes-body');
    const table = document.getElementById('episodes-table');
    const noResults = document.getElementById('no-results');

    // Clear existing rows
    tbody.innerHTML = '';

    // Show/hide appropriate elements based on results
    if (!episodes || episodes.length === 0) {
        table.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }

    table.style.display = 'table';
    noResults.style.display = 'none';

    // Create row for each episode
    episodes.forEach(episode => {
        const row = document.createElement('tr');
        
        // Format and add each cell with edge case handling
        row.innerHTML = `
            <td>${episode.rank || 'N/A'}</td>
            <td>${sanitizeHtml(episode.title)}</td>
            <td>${episode.series || 'N/A'}</td>
            <td>${episode.era || 'Unknown'}</td>
            <td>${formatDate(episode.broadcast_date)}</td>
            <td>${sanitizeHtml(episode.director) || 'Unknown'}</td>
            <td style="white-space: pre-line">${formatWriters(episode.writer)}</td>
            <td>${formatDoctor(episode.doctor)}</td>
            <td>${formatCompanion(episode.companion)}</td>
            <td><span class="cast-count">${formatCastCount(episode.cast)}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

// Helper functions for formatting display data
function sanitizeHtml(text) {
    if (!text) return 'Unknown';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatWriters(writer) {
    if (!writer) return 'Unknown';
    
    // Split writers before sanitizing HTML
    let writers = writer
        .split(/\s*(?:,|\band\b|&)\s*/) // Split on commas, "and", or "&" with surrounding whitespace
        .map(w => w.trim())
        .filter(w => w.length > 0); // Remove empty strings
    
    if (writers.length === 0) return 'Unknown';
    
    // Sanitize individual writers
    writers = writers.map(w => sanitizeHtml(w));
    
    if (writers.length === 1) return writers[0];
    if (writers.length === 2) return `${writers[0]} and ${writers[1]}`;
    
    // For 3 or more writers
    const lastWriter = writers.pop();
    return `${writers.join(', ')} and ${lastWriter}`;
}

function formatDoctor(doctor) {
    if (!doctor || !doctor.actor || !doctor.incarnation) return 'Unknown';
    return `${sanitizeHtml(doctor.actor)} (${sanitizeHtml(doctor.incarnation)})`;
}

function formatCompanion(companion) {
    if (!companion) return '—';  // Handle null companion
    if (!companion.actor || !companion.character) return 'Unknown';
    return `${sanitizeHtml(companion.actor)} (${sanitizeHtml(companion.character)})`;
}

function formatCastCount(cast) {
    return Array.isArray(cast) ? cast.length : 0;
}

// Utility Functions
function formatDate(date) {
    if (!date) return 'Unknown';

    // Try parsing different date formats
    let year;

    // Handle YYYY format
    if (/^\d{4}$/.test(date)) {
        return date;
    }

    // Try ISO format (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        year = date.split('-')[0];
    }
    // Try UK format (DD/MM/YYYY)
    else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
        year = date.split('/')[2];
    }
    // Try Long format (Month DD, YYYY)
    else if (/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(date)) {
        year = date.split(', ')[1];
    } else {
        // Try parsing with Date object as fallback
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            year = parsedDate.getFullYear().toString();
        }
    }

    // Log problematic dates for debugging
    if (!year) {
        console.warn(`Unparseable date format:`, date);
    }

    return year || 'Unknown';
}

// Sorting Functions
function sortEpisodes(field) {
    const direction = state.sort.ascending ? 1 : -1;

    state.filtered.sort((a, b) => {
        let valueA, valueB;

        // Extract values based on field
        switch (field) {
            case 'rank':
                valueA = a[field] || 0;
                valueB = b[field] || 0;
                return (valueA - valueB) * direction;
                
            case 'series':
                // Handle "Special" episodes by giving them a high value
                valueA = a[field] === 'Special' ? Number.MAX_SAFE_INTEGER : (Number(a[field]) || 0);
                valueB = b[field] === 'Special' ? Number.MAX_SAFE_INTEGER : (Number(b[field]) || 0);
                return (valueA - valueB) * direction;

            case 'title':
            case 'era':
            case 'director':
                valueA = (a[field] || '').toLowerCase();
                valueB = (b[field] || '').toLowerCase();
                return valueA.localeCompare(valueB) * direction;

            case 'broadcast_date':
                // Extract years for comparison
                valueA = formatDate(a.broadcast_date) || '0';
                valueB = formatDate(b.broadcast_date) || '0';
                return valueA.localeCompare(valueB) * direction;

            case 'writer':
                valueA = (a[field] || '').toLowerCase().split(/ (?:&|and) /)[0]; // Use first writer
                valueB = (b[field] || '').toLowerCase().split(/ (?:&|and) /)[0];
                return valueA.localeCompare(valueB) * direction;

            case 'doctor':
                valueA = a.doctor ? (a.doctor.actor || '').toLowerCase() : '';
                valueB = b.doctor ? (b.doctor.actor || '').toLowerCase() : '';
                return valueA.localeCompare(valueB) * direction;

            case 'companion':
                // Handle null companions
                if (!a.companion && !b.companion) return 0;
                if (!a.companion) return direction;
                if (!b.companion) return -direction;
                
                valueA = (a.companion.actor || '').toLowerCase();
                valueB = (b.companion.actor || '').toLowerCase();
                return valueA.localeCompare(valueB) * direction;

            case 'cast':
                valueA = Array.isArray(a.cast) ? a.cast.length : 0;
                valueB = Array.isArray(b.cast) ? b.cast.length : 0;
                return (valueA - valueB) * direction;

            default:
                return 0;
        }
    });

    // Update display
    displayEpisodes(state.filtered);
}

// Filtering Functions
function filterEpisodes() {
    const nameFilter = state.filters.name.toLowerCase().trim();

    // If no filter is applied, show all episodes
    if (!nameFilter) {
        state.filtered = [...state.episodes];
    } else {
        // Filter episodes by name (case-insensitive partial match)
        state.filtered = state.episodes.filter(episode => {
            const title = (episode.title || '').toLowerCase();
            return title.includes(nameFilter);
        });
    }

    // Apply current sort after filtering
    if (state.sort.field) {
        sortEpisodes(state.sort.field);
    } else {
        // If no sort is applied, just display the filtered results
        displayEpisodes(state.filtered);
    }

    // Show "no results" if filtered array is empty
    const noResults = document.getElementById('no-results');
    const table = document.getElementById('episodes-table');
    
    if (state.filtered.length === 0) {
        table.style.display = 'none';
        noResults.style.display = 'block';
    } else {
        table.style.display = 'table';
        noResults.style.display = 'none';
    }
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
    document.getElementById('episodes-table').style.display = show ? 'none' : 'block';
}

function showError(message) {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.style.display = message ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', init);
