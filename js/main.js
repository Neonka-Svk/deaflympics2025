// --- Configuration ---
const TOKYO_TIMEZONE = 'Asia/Tokyo';
const BRATISLAVA_TIMEZONE = 'Europe/Bratislava';
// 3 minutes buffer before actual start (Upcoming -> Live)
const LIVE_THRESHOLD_MS = 3 * 60 * 1000; 
// 6 hours duration after the event start time (Live -> Passed)
const LIVE_DURATION_MS = 6 * 60 * 60 * 1000; 

// --- Time Formatting Functions ---

/**
 * Converts a UTC ISO string to local time string in a specific timezone.
 * @param {string} isoString - The event date in ISO 8601 format.
 * @param {string} timeZone - The target timezone.
 * @param {boolean} includeDate - Whether to include the date.
 * @returns {string} Formatted date/time string.
 */
function formatTime(isoString, timeZone, includeDate = false) {
    const date = isoString ? new Date(isoString) : new Date();
    const options = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit', 
        hour12: false, 
        timeZone 
    };
    if (includeDate) {
        options.year = 'numeric';
        options.month = 'long';
        options.day = 'numeric';
        delete options.hour;
        delete options.minute;
        delete options.second;
    }
    // Use 'sk-SK' for Slovak locale formatting
    return date.toLocaleString('sk-SK', options);
}

/**
 * Updates the two main clocks (Japan and Slovakia).
 */
function updateClocks() {
    const now = new Date().toISOString();

    // Japan Clock
    document.getElementById('japan-time').textContent = formatTime(now, TOKYO_TIMEZONE);
    document.getElementById('japan-date').textContent = formatTime(now, TOKYO_TIMEZONE, true);

    // Slovakia Clock
    document.getElementById('slovakia-time').textContent = formatTime(now, BRATISLAVA_TIMEZONE);
    document.getElementById('slovakia-date').textContent = formatTime(now, BRATISLAVA_TIMEZONE, true);
}

// --- Countdown Logic ---

/**
 * Calculates remaining time and updates the countdown timer element.
 * @param {string} eventISODate - The future event date in ISO 8601 format.
 * @returns {object} {status: 'live'|'upcoming'|'passed', timerText: string}
 */
function getEventStatus(eventISODate) {
    const now = new Date().getTime();
    const eventTime = new Date(eventISODate).getTime();
    
    // Time until start (positive if in future, negative if in past)
    const distanceToStart = eventTime - now; 
    
    // Time until the end of the 8-hour LIVE window
    const liveEndTime = eventTime + LIVE_DURATION_MS;
    const distanceToLiveEnd = liveEndTime - now;

    let status = 'upcoming';
    let timerText = '';

    if (distanceToLiveEnd < 0) {
        // Event is past the 8-hour window
        status = 'passed';
        timerText = "Už prebehlo";
    } else if (distanceToStart <= LIVE_THRESHOLD_MS) {
        // Event is about to start (within 5 min) or has already started
        status = 'live';
        timerText = "Naživo";
    } else {
        // Upcoming (More than 5 minutes away)
        const distance = distanceToStart;
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const pad = (num) => String(num).padStart(2, '0');

        timerText = days > 0 ? `Ostáva: <span class="time-value event">${pad(days)}:</span>` : 'Ostáva: ';
        timerText += `<span class="time-value event">${pad(hours)}:${pad(minutes)}:${pad(seconds)}</span>`;
    }
    
    return { status, timerText };
}

/**
 * Updates the status box and countdown elements.
 */
function updateAccordionHeaders() {
    let firstLiveEventItem = null;
    const now = new Date().getTime();

    document.querySelectorAll('.accordion-item').forEach(item => {
        const eventDate = item.dataset.eventDate;
        const statusBoxes = item.querySelectorAll('.status-box');
        const eventTime = new Date(eventDate).getTime();
        
        if (!eventDate || !statusBoxes) return;

        const { status, timerText } = getEventStatus(eventDate);
        
        // Update the data-is-live attribute dynamically based on the 8-hour rule
        // The element is 'live' if the time is between 5 min before start and 8 hours after start
        const isTemporarilyLive = (eventTime - now) <= LIVE_THRESHOLD_MS && (eventTime + LIVE_DURATION_MS) >= now;
        
        // This block automatically toggles the data attribute used for the initial page load check
        if (isTemporarilyLive) {
            item.dataset.isLive = 'true';
        } else {
            item.dataset.isLive = 'false';
        }

        // Check for the first live event (used for auto-open on load)
        if (status === 'live' && !firstLiveEventItem) {
            firstLiveEventItem = item;
        }

        // --- UI Update: Loop through ALL found status boxes ---
        statusBoxes.forEach(statusBox => {
            statusBox.innerHTML = status === 'passed' ? 'Už prebehlo' : (status === 'live' ? 'Naživo' : timerText);

            // Reset classes
            statusBox.classList.remove('live_event', 'upcoming_event', 'passed_event');

            if (status === 'live') {
                statusBox.classList.add('live_event');
            } else if (status === 'passed') {
                statusBox.classList.add('passed_event');
            } else {
                statusBox.classList.add('upcoming_event');
            }
        });

        // Update the main countdown section separately (this is usually a single element outside the header)
        const countdownElement = document.getElementById(`countdown-${eventDate.replace(/[^a-zA-Z0-9]/g, '-')}`);
        if (countdownElement) {
            if (status === 'live') {
                countdownElement.innerHTML = "Naživo!";
            } else if (status === 'upcoming') {
                countdownElement.innerHTML = timerText;
            }
        }
    });
    
    return firstLiveEventItem;
}


// --- Accordion Logic ---

function toggleAccordion(item, forceOpen = false) {
    const header = item.querySelector('.accordion-header');
    const content = item.querySelector('.accordion-content');
    const icon = header.querySelector('svg');
    let isExpanded = item.classList.contains('active');
    
    if (forceOpen) {
        isExpanded = false; // Treat it as closed if forcing open
    }

    // Close all others unless we are opening (to avoid closing itself)
    if (!isExpanded || forceOpen) {
        document.querySelectorAll('.accordion-item.active').forEach(activeItem => {
            activeItem.classList.remove('active');
            activeItem.querySelector('.accordion-content').style.maxHeight = null;
            activeItem.querySelector('svg').classList.remove('rotate-180');
        });
    }


    if (forceOpen || !isExpanded) {
        item.classList.add('active');
        // Set maxHeight to scrollHeight + buffer for padding/border
        // We use scrollHeight + 30px buffer to prevent content jump 
        content.style.maxHeight = content.scrollHeight + 30 + "px"; 
        icon.classList.add('rotate-180');
        
        // Scroll to the item if forced open (on page load)
        if (forceOpen) {
            item.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    } else {
        item.classList.remove('active');
        content.style.maxHeight = null;
        icon.classList.remove('rotate-180');
    }
}

/**
 * Initializes and handles the accordion behavior.
 */
function setupAccordions() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const item = header.closest('.accordion-item');
            toggleAccordion(item);
        });
    });
}


// --- Main Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Clocks
    updateClocks();
    setInterval(updateClocks, 1000);

    // 2. Initialize Accordion click handlers
    setupAccordions();
    
    // 3. Initialize Accordion Headers/Countdowns
    // We run this once to get the initial status and then repeatedly
    const initialLiveEvent = updateAccordionHeaders();
    setInterval(updateAccordionHeaders, 1000);
    
    // 4. Auto-Open and Scroll to the first currently LIVE event
    if (initialLiveEvent) {
        // Ensure the max-height calculation happens after the content is rendered
        setTimeout(() => {
            toggleAccordion(initialLiveEvent, true);
        }, 100); 
    }
});