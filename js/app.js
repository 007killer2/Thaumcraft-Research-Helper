
const searchInput = document.getElementById('searchInput');
const researchList = document.getElementById('researchList');
const copyNotification = document.getElementById('copyNotification');
const themeToggle = document.getElementById('themeToggle');
const body = document.body;
const loadMoreTrigger = document.getElementById('loadMoreTrigger');
const loadingIndicator = document.getElementById('loadingIndicator');

// Global variables
let allResearch = [];
let currentFilteredResearch = [];
let modColors = {};
let categoryColors = {};
let resizeTimeout;
let isRendering = false;

// Lazy loading variables
let itemsPerLoad = 30; // Number of items to load per batch
let currentlyLoaded = 0;
let isLoadingMore = false;
let observer = null;

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    body.setAttribute('data-theme', savedTheme);
}

// Toggle theme
function toggleTheme() {
    const currentTheme = body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    regenerateColors();
}

// Regenerate colors when theme changes
function regenerateColors() {
    modColors = {};
    categoryColors = {};

    const mods = [...new Set(allResearch.map(item => item.mod))];
    mods.forEach(mod => getModColor(mod));

    const categories = [...new Set(allResearch.map(item => item.research_category))];
    categories.forEach(category => getCategoryColor(category));

    saveColors();
    // Reset and reload with new colors
    currentlyLoaded = 0;
    displayResearchBatch(currentFilteredResearch);
}

// Initialize colors from localStorage or create empty objects
function initializeColors() {
    try {
        const savedModColors = localStorage.getItem('researchModColors');
        const savedCategoryColors = localStorage.getItem('researchCategoryColors');
        modColors = savedModColors ? JSON.parse(savedModColors) : {};
        categoryColors = savedCategoryColors ? JSON.parse(savedCategoryColors) : {};
    } catch (e) {
        console.warn('Error accessing localStorage, using default colors');
        modColors = {};
        categoryColors = {};
    }
}

// Save colors to localStorage
function saveColors() {
    try {
        localStorage.setItem('researchModColors', JSON.stringify(modColors));
        localStorage.setItem('researchCategoryColors', JSON.stringify(categoryColors));
    } catch (e) {
        console.warn('Error saving colors to localStorage');
    }
}

// Generate a color from a string (hash-based) with theme awareness
function generateColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }

    const isDarkTheme = body.getAttribute('data-theme') === 'dark';
    const h = Math.abs(hash) % 360;
    let s, l;
    if (isDarkTheme) {
        s = 40 + (Math.abs(hash >> 8) % 20);
        l = 35 + (Math.abs(hash >> 16) % 15);
    } else {
        s = 60 + (Math.abs(hash >> 8) % 20);
        l = 45 + (Math.abs(hash >> 16) % 15);
    }
    return `hsl(${h}, ${s}%, ${l}%)`;
}

// Get or create a color for a mod
function getModColor(mod) {
    if (!modColors[mod]) {
        modColors[mod] = generateColor(mod);
        saveColors();
    }
    return modColors[mod];
}

// Get or create a color for a category
function getCategoryColor(category) {
    if (!categoryColors[category]) {
        categoryColors[category] = generateColor(category);
        saveColors();
    }
    return categoryColors[category];
}

// Show copy notification
function showCopyNotification(message = 'Copied to clipboard!') {
    copyNotification.textContent = message;
    console.log(copyNotification.textContent);
    copyNotification.classList.add('show');
    setTimeout(() => {
        copyNotification.classList.remove('show');
    }, 2000);
}

async function copyToClipboard(text) {
    // try {
    //     if (navigator.clipboard && navigator.clipboard.writeText) {
    //         await navigator.clipboard.writeText(text);
    //         showCopyNotification();
    //     } else {
    //         // Fallback для старых браузеров
    //         const textArea = document.createElement('textarea');
    //         textArea.value = text;
    //         textArea.style.position = 'fixed';
    //         textArea.style.top = '-9999px';
    //         textArea.style.left = '-9999px';
    //         document.body.appendChild(textArea);
    //         textArea.focus();
    //         textArea.select();
    //         document.execCommand('copy');
    //         document.body.removeChild(textArea);
    //         showCopyNotification();
    //     }
    // } catch (err) {
    //     console.error('Copy failed:', err);
    //     showCopyNotification('Failed to copy!');
    // }
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Make the textarea out of sight
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showCopyNotification();
        } else {
            showCopyNotification('Failed to copy!');
        }
    } catch (err) {
        showCopyNotification('Failed to copy!');
        console.error('Fallback: Oops, unable to copy', err);
    }
    document.body.removeChild(textArea);
}

// Optimized masonry layout function
function applyMasonryLayout() {
    const container = researchList;
    const items = container.querySelectorAll('.research-card:not(.no-results):not(.loading)');

    if (items.length === 0) return;

    const containerWidth = container.offsetWidth;
    let columnCount = (window.innerWidth <= 600) ? 1 : (window.innerWidth <= 900) ? 2 : 3;
    const gap = 20;
    const columnWidth = (containerWidth - (gap * (columnCount - 1))) / columnCount;

    const columnPositions = new Array(columnCount).fill(0).map((_, i) => ({
        x: i * (columnWidth + gap),
        height: 0
    }));

    items.forEach((item, index) => {
        let minColumn = columnPositions.reduce((min, col, idx) =>
            col.height < columnPositions[min].height ? idx : min, 0);

        const x = columnPositions[minColumn].x;
        const y = columnPositions[minColumn].height;

        item.style.position = 'absolute';
        item.style.left = `${x}px`;
        item.style.top = `${y}px`;
        item.style.width = `${columnWidth}px`;
        item.style.animationDelay = `${index * 30}ms`;

        columnPositions[minColumn].height = y + item.offsetHeight + gap;
    });

    const maxHeight = Math.max(...columnPositions.map(col => col.height));
    container.style.height = `${maxHeight}px`;
    isRendering = false;
}

// Handle window resize with debounce
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        applyMasonryLayout();
    }, 100);
}

// Setup Intersection Observer for lazy loading
function setupIntersectionObserver() {
    if (observer) {
        observer.disconnect();
    }

    observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && currentlyLoaded < currentFilteredResearch.length) {
            loadMoreItems();
        }
    }, {
        rootMargin: '200px 0px' // Start loading 200px before the trigger comes into view
    });

    observer.observe(loadMoreTrigger);
}

// Load more items for lazy loading
function loadMoreItems() {
    if (isLoadingMore || currentlyLoaded >= currentFilteredResearch.length) return;

    isLoadingMore = true;
    loadingIndicator.style.display = 'flex';

    // Simulate a small delay to show loading indicator
    setTimeout(() => {
        const nextBatch = currentFilteredResearch.slice(currentlyLoaded, currentlyLoaded + itemsPerLoad);
        const fragment = document.createDocumentFragment();

        nextBatch.forEach(research => {
            fragment.appendChild(createResearchCard(research));
        });

        researchList.appendChild(fragment);
        currentlyLoaded += nextBatch.length;

        applyMasonryLayout();

        loadingIndicator.style.display = 'none';
        isLoadingMore = false;

        // If we've loaded all items, disconnect the observer
        if (currentlyLoaded >= currentFilteredResearch.length) {
            observer.disconnect();
        }
    }, 300);
}

// Load all items for a specific category
function loadAllItemsForCategory(callback) {
    if (isLoadingMore) return;

    isLoadingMore = true;
    loadingIndicator.style.display = 'flex';

    // Load in batches to avoid UI freezing
    function loadBatch() {
        const nextBatch = currentFilteredResearch.slice(currentlyLoaded, currentlyLoaded + itemsPerLoad);

        if (nextBatch.length === 0) {
            loadingIndicator.style.display = 'none';
            isLoadingMore = false;
            if (callback) callback();
            return;
        }

        const fragment = document.createDocumentFragment();
        nextBatch.forEach(research => {
            fragment.appendChild(createResearchCard(research));
        });

        researchList.appendChild(fragment);
        currentlyLoaded += nextBatch.length;

        applyMasonryLayout();

        // Continue loading next batch
        requestAnimationFrame(loadBatch);
    }

    loadBatch();
}

// Fetch research data
fetch('https://raw.githubusercontent.com/007killer2/Thaumcraft-Research-Helper/main/thaumcraft_researches.json')
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        initializeTheme();
        initializeColors();

        allResearch = [];
        for (const mod in data) {
            for (const key in data[mod]) {
                const research = data[mod][key];
                research.mod = mod;
                allResearch.push(research);
            }
        }

        currentFilteredResearch = [...allResearch];
        currentlyLoaded = 0;
        displayResearchBatch(currentFilteredResearch);

        // Setup lazy loading after initial load
        setupIntersectionObserver();

        searchInput.addEventListener('input', handleSearch);
        window.addEventListener('resize', handleResize);
        themeToggle.addEventListener('click', toggleTheme);
    })
    .catch(error => {
        console.error('Error fetching research data:', error);
        researchList.innerHTML = '<div class="no-results">Error loading research data. Please try again later.</div>';
    });

// Display initial batch of research items
function displayResearchBatch(researchItems) {
    researchList.innerHTML = '';
    researchList.style.height = 'auto';

    if (researchItems.length === 0) {
        researchList.innerHTML = '<div class="no-results">No research keys found</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    const initialBatch = researchItems.slice(0, itemsPerLoad);

    initialBatch.forEach(research => {
        fragment.appendChild(createResearchCard(research));
    });

    researchList.appendChild(fragment);
    currentlyLoaded = initialBatch.length;

    applyMasonryLayout();

    // If all items fit in the initial batch, disconnect the observer
    if (currentlyLoaded >= researchItems.length && observer) {
        observer.disconnect();
    }
}


function createResearchCard(research) {
    const card = document.createElement('div');
    card.className = 'research-card';
    card.id = `research-${research.research_key}`;

    const modColor = getModColor(research.mod);
    card.style.borderLeftColor = modColor;

    const categoryColor = getCategoryColor(research.research_category);

    let parentsHtml = '';
    const hasParents = research.research_parents.length > 0 || research.research_hidden_parents.length > 0;

    if (hasParents) {
        parentsHtml += `<div class="parents-header"><div class="parents-title">Parents</div><button class="copy-all-button" data-research-key="${research.research_key}"><span>📋</span> Copy All</button></div>`;
    }

    if (research.research_parents.length > 0) {
        parentsHtml += `<div class="parents-block"><div class="parent-list">${research.research_parents.map(p => `<span class="parent-item" data-parent-key="${p}">${p}</span>`).join('')}</div></div>`;
    }

    if (research.research_hidden_parents.length > 0) {
        parentsHtml += `<div class="parents-block"><div class="parents-title">Hidden Parents: <span class="hidden-icon" title="Hidden parents required">👁️‍🗨️</span></div><div class="parent-list">${research.research_hidden_parents.map(p => `<span class="parent-item" data-parent-key="${p}">${p}</span>`).join('')}</div></div>`;
    }

    card.innerHTML = `
                <div class="research-key" data-key="${research.research_key}">${research.research_key}</div>
                <div class="research-name">${research.research_local_name}</div>
                <div class="research-details">
                    <div class="detail-row"><span class="detail-label">Mod:</span><span class="mod-tag" style="background-color: ${modColor}">${research.mod}</span></div>
                    <div class="detail-row"><span class="detail-label">Category:</span><span class="category-tag" data-category="${research.research_category}" style="background-color: ${categoryColor}">${research.research_category}</span></div>
                    <div class="detail-row"><span class="detail-label">Complexity:</span><span class="complexity">${research.research_complexity}</span></div>
                </div>
                ${parentsHtml ? `<div class="parents-section">${parentsHtml}</div>` : ''}
            `;
    return card;

}

// Handle search
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    currentFilteredResearch = allResearch.filter(r =>
        r.research_key.toLowerCase().includes(searchTerm) ||
        r.research_local_name.toLowerCase().includes(searchTerm) ||
        r.mod.toLowerCase().includes(searchTerm) ||
        r.research_category.toLowerCase().includes(searchTerm) ||
        r.research_parents.some(p => p.toLowerCase().includes(searchTerm)) ||
        r.research_hidden_parents.some(p => p.toLowerCase().includes(searchTerm))
    );

    // Reset lazy loading state for new search results
    currentlyLoaded = 0;
    displayResearchBatch(currentFilteredResearch);

    // Re-setup the observer for the new results
    setupIntersectionObserver();
}

// Handle research key click - copy to clipboard
function handleResearchKeyClick(event) {
    const key = event.target.getAttribute('data-key');
    copyToClipboard(key);
    event.target.classList.add('copied');
    setTimeout(() => event.target.classList.remove('copied'), 600);
}

// Handle category click - only copy to clipboard
function handleCategoryClick(event) {
    const category = event.target.getAttribute('data-category');
    copyToClipboard(category);
    event.target.classList.add('copied');
    setTimeout(() => event.target.classList.remove('copied'), 600);
}

// Handle copy all parents click
function handleCopyAllParents(event) {
    const button = event.target.closest('.copy-all-button');
    console.log(button);
    if (!button) return;
    const researchKey = button.getAttribute('data-research-key');
    const research = allResearch.find(r => r.research_key === researchKey);
    if (research) {
        console.log(research);
        const allParents = [...research.research_parents, ...research.research_hidden_parents];
        if (allParents.length > 0) {
            console.log(allParents.length);
            copyToClipboard(JSON.stringify(allParents));
            showCopyNotification(`Copied ${allParents.length} parent keys as a string array!`);
        }
    }
}

// Handle parent click - scroll to parent research
function handleParentClick(event) {
    const parentKey = event.target.getAttribute('data-parent-key');
    const parentElement = document.getElementById(`research-${parentKey}`);

    // Если элемент уже есть в DOM → просто скроллим
    if (parentElement) {
        scrollToResearch(parentKey);
        return;
    }

    // Проверка: есть ли родитель в текущем списке
    const parentInCurrentList = currentFilteredResearch.some(r => r.research_key === parentKey);

    if (!parentInCurrentList) {
        // Если родителя нет в фильтре → сбрасываем на полный список
        searchInput.value = '';
        currentFilteredResearch = [...allResearch];
        currentlyLoaded = 0;
        researchList.innerHTML = '';
    }

    // В любом случае подгружаем партиями, пока не найдём нужного
    if (observer) observer.disconnect();

    let found = false;
    let index = parentInCurrentList ? currentlyLoaded : 0;
    const batchSize = itemsPerLoad;

    function loadBatchUntilFound() {
        const endIndex = Math.min(index + batchSize, currentFilteredResearch.length);
        const fragment = document.createDocumentFragment();

        for (let i = index; i < endIndex; i++) {
            const research = currentFilteredResearch[i];
            const card = createResearchCard(research);
            fragment.appendChild(card);

            if (research.research_key === parentKey) {
                found = true;
            }
        }

        researchList.appendChild(fragment);
        currentlyLoaded = endIndex;
        index = endIndex;

        applyMasonryLayout();

        if (found) {
            scrollToResearch(parentKey);
            setupIntersectionObserver();
        } else if (index < currentFilteredResearch.length) {
            requestAnimationFrame(loadBatchUntilFound);
        } else {
            setupIntersectionObserver();
        }
    }

    loadBatchUntilFound();
}

// Scroll to a specific research
function scrollToResearch(researchKey) {
    const element = document.getElementById(`research-${researchKey}`);
    if (element) {
        document.querySelectorAll('.research-card.highlighted').forEach(c => c.classList.remove('highlighted'));
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('highlighted');
        setTimeout(() => element.classList.remove('highlighted'), 2000);
    }
}

// Event delegation
researchList.addEventListener('click', function(event) {
    const target = event.target;
    if (target.classList.contains('research-key')) {
        handleResearchKeyClick(event);
    } else if (target.classList.contains('category-tag')) {
        handleCategoryClick(event);
    } else if (target.closest('.copy-all-button')) {
        handleCopyAllParents(event);
    } else if (target.classList.contains('parent-item')) {
        handleParentClick(event);
    }
});
