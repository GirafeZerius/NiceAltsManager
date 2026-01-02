// NiceAlts Manager - Premium Frontend - Complete Feature Set
const API_BASE = '/api';

// State Management
let state = {
    apiKey: '',
    hypixelKey: '',
    balance: null,
    stock: [],
    accounts: [],
    activityLog: [],
    currentAccount: null,
    settings: {},
    chatMessages: [],
    chatEnabled: false,
    chatName: '',
    chatApiUrl: '',
    geminiApiKey: ''
};

// Modal Management
let currentModal = null;

// Initialize with GSAP animations
document.addEventListener('DOMContentLoaded', () => {
    // Animate page load
    gsap.from('.premium-header', {
        opacity: 0,
        y: -20,
        duration: 0.6,
        ease: 'power3.out'
    });
    
    gsap.from('.stat-card', {
        opacity: 0,
        y: 20,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out'
    });
    
    gsap.from('.premium-card', {
        opacity: 0,
        y: 30,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
        delay: 0.2
    });
    
    initializeApp();
});

// Initialize Application
async function initializeApp() {
    try {
        console.log('Initializing app...');
        
        // Show alpha warning on first load
        const alphaBanner = document.getElementById('alphaWarningBanner');
        if (alphaBanner && !localStorage.getItem('alphaWarningDismissed')) {
            alphaBanner.style.display = 'block';
        }
        
        // Setup event listeners first
        setupEventListeners();
        
        // Load all data in parallel for faster initialization
        await Promise.all([
            loadSettings(),
            loadConfig(),
            loadAccounts()
        ]);
        
        // Then load balance and stock (these might need API key)
        try {
            await checkBalance();
        } catch (error) {
            console.warn('Balance check failed (might need API key):', error);
            const balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.innerHTML = `
                    <div style="text-align: center; padding: 1rem;">
                        <div style="font-size: 1.5rem; font-weight: 700; color: var(--text-muted);">
                            Balance: N/A
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">
                            Enter API key and click Check Balance
                        </div>
                    </div>
                `;
            }
        }
        
        try {
            await checkStock();
        } catch (error) {
            console.warn('Stock check failed (might need API key):', error);
            const stockDisplay = document.getElementById('stockDisplay');
            if (stockDisplay) {
                stockDisplay.innerHTML = '<div class="loading-state"><i class="fas fa-exclamation-triangle"></i><p>Enter API key to load stock</p></div>';
            }
        }
        
        // Initialize chat if enabled
        if (state.chatEnabled && state.chatApiUrl) {
            try {
                await loadChatMessages();
                startChatPolling();
            } catch (error) {
                console.warn('Chat initialization failed:', error);
            }
        }
        
        // Update all UI elements
        updateStats();
        updateAccountDisplay();
        
        // Start auto-refresh
        startAutoRefresh();
        
        addLogEntry('System initialized successfully', 'success');
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing application. Check console for details.', 'error');
        addLogEntry(`Initialization error: ${error.message}`, 'error');
    }
}

// Event Listeners
function setupEventListeners() {
    // Helper function to safely add event listeners
    function safeAddListener(id, event, handler) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with id '${id}' not found`);
        }
    }
    
    // Configuration
    safeAddListener('saveConfigBtn', 'click', saveConfig);
    safeAddListener('toggleApiKey', 'click', toggleApiKeyVisibility);
    
    // Balance & Stock
    safeAddListener('checkBalanceBtn', 'click', checkBalance);
    safeAddListener('quickBalanceBtn', 'click', checkBalance);
    safeAddListener('checkBalanceAction', 'click', checkBalance);
    safeAddListener('refreshStockBtn', 'click', checkStock);
    safeAddListener('quickStockBtn', 'click', checkStock);
    safeAddListener('checkStockAction', 'click', checkStock);
    
    // Purchase
    safeAddListener('purchaseBtn', 'click', purchaseAccounts);
    safeAddListener('freeAltsBtn', 'click', openFreeAltsModal);
    safeAddListener('addCustomTokenBtn', 'click', openAddTokenModal);
    safeAddListener('checkAllTokensBtn', 'click', checkAllTokens);
    
    // Chat
    safeAddListener('chatSendBtn', 'click', sendChatMessage);
    safeAddListener('chatInput', 'keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });
    safeAddListener('chatSettingsBtn', 'click', openChatSettingsModal);
    
    // Actions
    safeAddListener('clearResultsBtn', 'click', clearResults);
    safeAddListener('clearLogBtn', 'click', clearLog);
    safeAddListener('viewAccountsAction', 'click', openAccountsModal);
    safeAddListener('exportDataAction', 'click', exportData);
    
    // Settings
    safeAddListener('settingsBtn', 'click', openSettingsModal);
    
    // Account Display
    safeAddListener('accountDisplayHeader', 'click', openAccountsModal);
    safeAddListener('headerUsernameBtn', 'click', (e) => {
        e.stopPropagation();
        if (state.currentAccount && state.currentAccount.token) {
            copyToClipboard(state.currentAccount.token);
            showToast('Token copied to clipboard', 'success');
        }
    });
}

// API Functions
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        const data = await response.json();
        if (data.success) {
            state.settings = data.settings;
            state.chatEnabled = data.settings.chat_enabled || false;
            state.chatName = data.settings.chat_name || '';
            state.chatApiUrl = data.settings.chat_api_url || '';
            state.geminiApiKey = data.settings.gemini_api_key || '';
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/config`);
        const data = await response.json();
        state.apiKey = data.api_key || '';
        state.hypixelKey = data.hypixel_key || '';
        
        const apiKeyInput = document.getElementById('apiKey');
        const hypixelKeyInput = document.getElementById('hypixelKey');
        const hypixelEnabledCheckbox = document.getElementById('hypixelEnabled');
        
        if (apiKeyInput) apiKeyInput.value = state.apiKey;
        if (hypixelKeyInput) hypixelKeyInput.value = state.hypixelKey;
        if (hypixelEnabledCheckbox) {
            hypixelEnabledCheckbox.checked = data.hypixel_enabled !== false;
        }
        
        addLogEntry('Configuration loaded', 'success');
    } catch (error) {
        console.error('Error loading config:', error);
        addLogEntry('Error loading configuration', 'error');
        showToast('Error loading configuration', 'error');
    }
}

async function loadAccounts() {
    try {
        const response = await fetch(`${API_BASE}/accounts`);
        const data = await response.json();
        if (data.success) {
            state.accounts = data.accounts || [];
        } else {
            state.accounts = [];
        }
        // Always update display even if empty
        updateAccountDisplay();
        updateStats();
    } catch (error) {
        console.error('Error loading accounts:', error);
        state.accounts = [];
        updateAccountDisplay();
        updateStats();
    }
}

async function saveConfig() {
    showLoading(true);
    const apiKey = document.getElementById('apiKey').value;
    const hypixelKey = document.getElementById('hypixelKey').value;
    const hypixelEnabled = document.getElementById('hypixelEnabled').checked;
    
    try {
        const response = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKey, hypixel_key: hypixelKey })
        });
        
        // Also update settings
        await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hypixel_enabled: hypixelEnabled })
        });
        
        if (response.ok) {
            state.apiKey = apiKey;
            state.hypixelKey = hypixelKey;
            state.settings.hypixel_enabled = hypixelEnabled;
            showToast('Configuration saved successfully', 'success');
            addLogEntry('Configuration saved', 'success');
        } else {
            showToast('Error saving configuration', 'error');
            addLogEntry('Failed to save configuration', 'error');
        }
    } catch (error) {
        showToast('Error saving configuration', 'error');
        addLogEntry('Error saving configuration', 'error');
    } finally {
        showLoading(false);
    }
}

async function checkBalance() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/balance`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.success) {
            state.balance = data.balance;
            const balanceStat = document.getElementById('balanceStat');
            if (balanceStat) {
                balanceStat.textContent = `${data.balance} Credits`;
            }
            
            // Update balance display
            const balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.innerHTML = `
                    <div style="font-size: 2rem; font-weight: 700; color: var(--accent-success); margin-bottom: 0.5rem;">
                        ${data.balance}
                    </div>
                    <div style="color: var(--text-secondary); font-size: 0.875rem;">
                        Credits Available
                    </div>
                    <div style="color: var(--text-muted); font-size: 0.75rem; margin-top: 0.5rem;">
                        User ID: ${data.user_id}
                    </div>
                `;
            }
            
            if (data.out_of_credits) {
                showToast('You are out of credits! Visit the store to purchase more.', 'warning');
            }
            
            updateStats();
            addLogEntry(`Balance checked: ${data.balance} credits`, 'success');
        } else {
            showToast(data.error || 'Error checking balance', 'error');
            addLogEntry('Failed to check balance', 'error');
        }
    } catch (error) {
        console.error('Error checking balance:', error);
        showToast(`Error checking balance: ${error.message}`, 'error');
        addLogEntry(`Error checking balance: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function checkStock() {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/stock`);
        const data = await response.json();
        
        if (data.success) {
            state.stock = data.products;
            displayStock(data.products, data.last_updated);
            
            // Update stock stat
            const inStock = data.products.filter(p => p.in_stock).length;
            document.getElementById('stockStat').textContent = `${inStock}/${data.products.length}`;
            
            // Show restock notifications
            if (data.restocked_items && data.restocked_items.length > 0) {
                data.restocked_items.forEach(item => {
                    showToast(`🛒 ${item.name} restocked! Stock: ${item.stock}`, 'success');
                    addLogEntry(`${item.name} restocked (${item.stock} available)`, 'success');
                });
            }
            
            updateStats();
            addLogEntry('Stock updated', 'success');
        } else {
            const stockDisplay = document.getElementById('stockDisplay');
            if (stockDisplay) {
                stockDisplay.innerHTML = '<div class="loading-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading stock</p></div>';
            }
            addLogEntry('Failed to load stock', 'error');
        }
    } catch (error) {
        const stockDisplay = document.getElementById('stockDisplay');
        if (stockDisplay) {
            stockDisplay.innerHTML = '<div class="loading-state"><i class="fas fa-exclamation-triangle"></i><p>Error loading stock</p></div>';
        }
        addLogEntry('Error loading stock', 'error');
    } finally {
        showLoading(false);
    }
}

function displayStock(products, lastUpdated) {
    const stockDisplay = document.getElementById('stockDisplay');
    if (!stockDisplay) return;
    
    if (products.length === 0) {
        stockDisplay.innerHTML = '<div class="loading-state"><i class="fas fa-box-open"></i><p>No products available</p></div>';
        return;
    }
    
    let html = '';
    products.forEach(product => {
        const icon = product.in_stock ? '<i class="fas fa-check-circle" style="color: var(--accent-success);"></i>' : 
                     '<i class="fas fa-times-circle" style="color: var(--text-muted);"></i>';
        const className = product.in_stock ? 'stock-item-premium in-stock' : 'stock-item-premium out-of-stock';
        
        html += `
            <div class="${className}">
                <div class="stock-name">
                    ${icon} ${product.name}
                </div>
                <div class="stock-details">
                    <span class="stock-price">${product.price} Credits</span>
                    <span class="stock-count">Stock: ${product.stock}</span>
                </div>
            </div>
        `;
    });
    
    stockDisplay.innerHTML = html;
    
    // Animate stock items
    gsap.from('.stock-item-premium', {
        opacity: 0,
        x: -20,
        duration: 0.4,
        stagger: 0.05,
        ease: 'power2.out'
    });
}

async function purchaseAccounts() {
    const type = document.getElementById('accountType').value;
    const amount = parseInt(document.getElementById('amount').value);
    
    if (!amount || amount < 1) {
        showToast('Amount must be at least 1', 'error');
        return;
    }
    
    showLoading(true);
    const btn = document.getElementById('purchaseBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    
    try {
        const response = await fetch(`${API_BASE}/purchase`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, amount })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Successfully purchased ${data.count} account(s)!`, 'success');
            displayResults(data.accounts, type);
            await checkBalance(); // Refresh balance
            await loadAccounts(); // Refresh accounts
            updateStats();
            addLogEntry(`Purchased ${data.count} ${type} account(s)`, 'success');
        } else {
            if (data.code === 409) {
                showToast('Out of stock', 'warning');
                addLogEntry('Purchase failed: Out of stock', 'warning');
            } else {
                showToast(data.error || 'Purchase failed', 'error');
                addLogEntry(`Purchase failed: ${data.error}`, 'error');
            }
        }
    } catch (error) {
        showToast('Error purchasing accounts', 'error');
        addLogEntry('Error purchasing accounts', 'error');
    } finally {
        showLoading(false);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function displayResults(accounts, type) {
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (!resultsDisplay) return;
    
    const timestamp = new Date().toLocaleString();
    
    let html = `✅ Successfully purchased ${accounts.length} account(s)!\n`;
    html += `🕐 Time: ${timestamp}\n`;
    html += `📦 Type: ${type}\n`;
    html += '='.repeat(80) + '\n\n';
    
    accounts.forEach((account, index) => {
        html += `Account ${index + 1}/${accounts.length}\n`;
        html += `${account.token}\n\n`;
    });
    
    resultsDisplay.textContent = html;
    resultsDisplay.scrollTop = 0;
    
    // Animate results
    gsap.from(resultsDisplay, {
        opacity: 0,
        y: 20,
        duration: 0.4,
        ease: 'power2.out'
    });
}

// Free Alts Functions
async function openFreeAltsModal() {
    // Load stock on open
    await loadMoriStock();
    await loadMyloAltsStock();
    showModalById('freeAltsModal');
    
    // Setup event listeners
    document.getElementById('fetchMoriBtn').addEventListener('click', () => fetchMoriAccount('unbanned'));
    document.getElementById('fetchMoriBannedBtn').addEventListener('click', () => fetchMoriAccount('banned'));
    document.getElementById('fetchMyloAltsBtn').addEventListener('click', () => fetchMyloAltsAccount('unbanned'));
    document.getElementById('fetchMyloAltsBannedBtn').addEventListener('click', () => fetchMyloAltsAccount('banned'));
}

function getFreeAltsModalContent() {
    return `
        <div class="modal-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <p><strong>WARNING:</strong> These accounts are SHARED. Other users may have access to the same accounts. The Mori API is UNOFFICIAL and may be unreliable. Use at your own risk and change passwords immediately if possible.</p>
        </div>
        
        <div class="free-alts-section">
            <h3><i class="fas fa-gift"></i> Mori</h3>
            <div class="free-alts-actions">
                <button class="btn-premium-secondary" id="fetchMoriBtn">
                    <i class="fas fa-download"></i> Fetch Unbanned
                    <span id="moriUnbannedStock" class="stock-badge">(Stock: ...)</span>
                </button>
                <button class="btn-premium-secondary" id="fetchMoriBannedBtn">
                    <i class="fas fa-download"></i> Fetch Banned
                    <span id="moriBannedStock" class="stock-badge">(Stock: ...)</span>
                </button>
            </div>
        </div>
        
        <div class="free-alts-section">
            <h3><i class="fas fa-gift"></i> MyloAlts</h3>
            <div class="free-alts-actions">
                <button class="btn-premium-secondary" id="fetchMyloAltsBtn">
                    <i class="fas fa-download"></i> Fetch Unbanned
                    <span id="myloAltsUnbannedStock" class="stock-badge">(Stock: ...)</span>
                </button>
                <button class="btn-premium-secondary" id="fetchMyloAltsBannedBtn">
                    <i class="fas fa-download"></i> Fetch Banned
                    <span id="myloAltsBannedStock" class="stock-badge">(Stock: ...)</span>
                </button>
            </div>
        </div>
    `;
}

async function loadMoriStock() {
    try {
        const response = await fetch(`${API_BASE}/free-alts/mori/stock`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('moriUnbannedStock').textContent = `(Stock: ${data.unbanned})`;
            document.getElementById('moriBannedStock').textContent = `(Stock: ${data.banned})`;
        }
    } catch (error) {
        console.error('Error loading Mori stock:', error);
    }
}

async function loadMyloAltsStock() {
    try {
        const response = await fetch(`${API_BASE}/free-alts/myloalts/stock`);
        const data = await response.json();
        if (data.success) {
            document.getElementById('myloAltsUnbannedStock').textContent = `(Stock: ${data.unbanned})`;
            document.getElementById('myloAltsBannedStock').textContent = `(Stock: ${data.banned})`;
        }
    } catch (error) {
        console.error('Error loading MyloAlts stock:', error);
    }
}

async function fetchMoriAccount(type) {
    if (!confirm('⚠️ WARNING: These accounts are SHARED.\n\nOther users may have access to the same accounts.\nThe Mori API is UNOFFICIAL and may be unreliable.\nUse at your own risk and change passwords immediately if possible.\n\nDo you want to continue?')) {
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/free-alts/mori/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Account fetched from Mori: ${data.username}`, 'success');
            await loadAccounts();
            closeModal();
            addLogEntry(`Fetched ${type} account from Mori: ${data.username}`, 'success');
        } else {
            if (data.code === 'CAPTCHA_REQUIRED') {
                if (confirm(`⚠️ A captcha needs to be solved before fetching accounts.\n\nPlease solve the captcha at this link:\n${data.captcha_link}\n\nAfter solving, you can try fetching again.\n\nOpen the captcha link now?`)) {
                    window.open(data.captcha_link, '_blank');
                }
            } else {
                showToast(data.error || 'Failed to fetch account', 'error');
            }
        }
    } catch (error) {
        showToast('Error fetching account from Mori', 'error');
    } finally {
        showLoading(false);
    }
}

async function fetchMyloAltsAccount(type) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/free-alts/myloalts/fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Account fetched from MyloAlts: ${data.username}`, 'success');
            await loadAccounts();
            closeModal();
            addLogEntry(`Fetched ${type} account from MyloAlts: ${data.username}`, 'success');
        } else {
            if (data.code === 'COOLDOWN') {
                showToast(`On cooldown. Please wait ${data.cooldown_remaining} seconds.`, 'warning');
            } else {
                showToast(data.error || 'Failed to fetch account', 'error');
            }
        }
    } catch (error) {
        showToast('Error fetching account from MyloAlts', 'error');
    } finally {
        showLoading(false);
    }
}

// Custom Token Functions
async function openAddTokenModal() {
    showModalById('addTokenModal');
    
    const submitBtn = document.getElementById('addTokenSubmitBtn');
    if (submitBtn && !submitBtn.hasAttribute('data-listener')) {
        submitBtn.addEventListener('click', addCustomToken);
        submitBtn.setAttribute('data-listener', 'true');
    }
}

function getAddTokenModalContent() {
    return `
        <div class="form-group-premium">
            <label class="form-label">
                <i class="fas fa-key"></i>
                Token
            </label>
            <p class="form-hint">Supports formats: Plain token, email:password | token, Accesstoken:TOKEN|username|uuid</p>
            <textarea id="customTokenInput" class="input-premium" rows="5" placeholder="Paste your token here..."></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn-premium-primary" id="addTokenSubmitBtn">
                <i class="fas fa-plus"></i> Add Token
            </button>
            <button class="btn-premium-secondary" onclick="closeModal()">
                Cancel
            </button>
        </div>
    `;
}

async function addCustomToken() {
    const token = document.getElementById('customTokenInput').value.trim();
    if (!token) {
        showToast('Please enter a token', 'error');
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/accounts/add-custom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Token added: ${data.username}`, 'success');
            await loadAccounts();
            closeModal();
            addLogEntry(`Added custom token: ${data.username}`, 'success');
        } else {
            showToast(data.error || 'Failed to add token', 'error');
        }
    } catch (error) {
        showToast('Error adding token', 'error');
    } finally {
        showLoading(false);
    }
}

// Accounts Management Functions
async function openAccountsModal() {
    await loadAccounts();
    const container = document.getElementById('accountsListContainer');
    if (container) {
        container.innerHTML = getAccountsModalContent();
    }
    showModalById('accountsModal');
    
    // Setup event listeners for all account buttons
    state.accounts.forEach((account, index) => {
        const switchBtn = document.getElementById(`switchAccountBtn_${index}`);
        const removeBtn = document.getElementById(`removeAccountBtn_${index}`);
        const viewBtn = document.getElementById(`viewAccountInfoBtn_${index}`);
        
        if (switchBtn && !switchBtn.hasAttribute('data-listener')) {
            switchBtn.addEventListener('click', () => switchAccount(account.username));
            switchBtn.setAttribute('data-listener', 'true');
        }
        if (removeBtn && !removeBtn.hasAttribute('data-listener')) {
            removeBtn.addEventListener('click', () => removeAccount(account.username));
            removeBtn.setAttribute('data-listener', 'true');
        }
        if (viewBtn && !viewBtn.hasAttribute('data-listener')) {
            viewBtn.addEventListener('click', () => viewAccountInfo(account));
            viewBtn.setAttribute('data-listener', 'true');
        }
    });
}

function getAccountsModalContent() {
    if (state.accounts.length === 0) {
        return '<p>No previous accounts available.</p>';
    }
    
    let html = '<div class="accounts-list">';
    state.accounts.forEach((account, index) => {
        const skinUrl = account.skin_url || 'https://crafatar.com/avatars/00000000000000000000000000000000';
        html += `
            <div class="account-item">
                <img src="${skinUrl}" alt="${account.username}" class="account-skin" onerror="this.src='https://crafatar.com/avatars/00000000000000000000000000000000'">
                <div class="account-info">
                    <div class="account-username">${account.username}</div>
                </div>
                <div class="account-actions">
                    <button class="btn-icon-small" id="viewAccountInfoBtn_${index}" title="View Info">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="btn-icon-small" id="switchAccountBtn_${index}" title="Switch">
                        <i class="fas fa-exchange-alt"></i>
                    </button>
                    <button class="btn-icon-small btn-danger" id="removeAccountBtn_${index}" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    return html;
}

async function switchAccount(username) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/accounts/switch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Switched to ${username}`, 'success');
            await loadAccounts();
            closeModal();
            addLogEntry(`Switched to account: ${username}`, 'success');
        } else {
            showToast(data.error || 'Failed to switch account', 'error');
        }
    } catch (error) {
        showToast('Error switching account', 'error');
    } finally {
        showLoading(false);
    }
}

async function removeAccount(username) {
    if (!confirm(`Are you sure you want to remove ${username} from previous accounts?`)) {
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/accounts/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Removed ${username}`, 'success');
            await loadAccounts();
            if (currentModal) {
                currentModal.querySelector('.modal-content').innerHTML = getAccountsModalContent();
                // Re-setup listeners
                state.accounts.forEach((account, index) => {
                    document.getElementById(`switchAccountBtn_${index}`).addEventListener('click', () => switchAccount(account.username));
                    document.getElementById(`removeAccountBtn_${index}`).addEventListener('click', () => removeAccount(account.username));
                    document.getElementById(`viewAccountInfoBtn_${index}`).addEventListener('click', () => viewAccountInfo(account));
                });
            }
            addLogEntry(`Removed account: ${username}`, 'info');
        } else {
            showToast(data.error || 'Failed to remove account', 'error');
        }
    } catch (error) {
        showToast('Error removing account', 'error');
    } finally {
        showLoading(false);
    }
}

async function viewAccountInfo(account) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/account/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: account.token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const modal = createModal(`Account Info: ${account.username}`, `
                <div class="account-info-display">
                    <pre style="white-space: pre-wrap; font-family: 'JetBrains Mono', monospace; background: var(--bg-panel); padding: 1rem; border-radius: 8px; overflow-x: auto;">${data.info}</pre>
                </div>
            `);
            showModal(modal);
        } else {
            showToast(data.error || 'Failed to fetch account info', 'error');
        }
    } catch (error) {
        showToast('Error fetching account info', 'error');
    } finally {
        showLoading(false);
    }
}

function updateAccountDisplay() {
    const headerSkinImg = document.getElementById('headerSkinImg');
    const headerSkinPlaceholder = document.getElementById('headerSkinPlaceholder');
    const headerUsernameBtn = document.getElementById('headerUsernameBtn');
    const headerServerInfo = document.getElementById('headerServerInfo');
    
    if (!headerUsernameBtn) return;
    
    const current = state.accounts.find(a => a.current) || state.accounts[0];
    if (current) {
        state.currentAccount = current;
        const username = current.username || 'Unknown';
        const skinUrl = current.skin_url || '';
        
        headerUsernameBtn.textContent = username;
        
        if (skinUrl && headerSkinImg && headerSkinPlaceholder) {
            headerSkinImg.src = skinUrl;
            headerSkinImg.alt = username;
            headerSkinImg.style.display = 'block';
            headerSkinPlaceholder.style.display = 'none';
        } else if (headerSkinPlaceholder) {
            if (headerSkinImg) headerSkinImg.style.display = 'none';
            headerSkinPlaceholder.style.display = 'flex';
        }
        
        // Update server info if available
        if (headerServerInfo && current.server_info) {
            if (current.server_info.on_server && current.server_info.server_name) {
                headerServerInfo.textContent = `🟢 ${current.server_info.server_name}`;
            } else {
                headerServerInfo.textContent = '';
            }
        } else if (headerServerInfo) {
            headerServerInfo.textContent = '';
        }
    } else {
        state.currentAccount = null;
        headerUsernameBtn.textContent = 'No Account';
        if (headerSkinImg) headerSkinImg.style.display = 'none';
        if (headerSkinPlaceholder) headerSkinPlaceholder.style.display = 'flex';
        if (headerServerInfo) headerServerInfo.textContent = '';
    }
}

// Settings Functions
async function openSettingsModal() {
    await loadSettings();
    await loadAccounts();
    
    // Update settings checkboxes
    const stockNotif = document.getElementById('stockNotificationsEnabled');
    const startupSound = document.getElementById('startupSoundEnabled');
    if (stockNotif) stockNotif.checked = state.settings.stock_notifications_enabled !== false;
    if (startupSound) startupSound.checked = state.settings.startup_sound_enabled !== false;
    
    // Update ban source radio buttons based on current account
    const hasCurrentAccount = state.currentAccount && state.currentAccount.token;
    const banSourceCurrent = document.getElementById('banSourceCurrent');
    const banSourcePurchased = document.getElementById('banSourcePurchased');
    const banSourceManual = document.getElementById('banSourceManual');
    const banTokenInput = document.getElementById('settingsBanTokenInput');
    
    if (banSourceCurrent) {
        banSourceCurrent.disabled = !hasCurrentAccount;
        banSourceCurrent.checked = hasCurrentAccount;
    }
    if (banSourcePurchased) {
        banSourcePurchased.disabled = !hasCurrentAccount;
    }
    if (banSourceManual) {
        banSourceManual.checked = !hasCurrentAccount;
    }
    if (banTokenInput) {
        banTokenInput.disabled = hasCurrentAccount;
    }
    
    showModalById('settingsModal');
    
    // Setup event listeners
    const saveBtn = document.getElementById('saveSettingsBtn');
    const decodeBtn = document.getElementById('settingsDecodeTokenBtn');
    const checkBanBtn = document.getElementById('settingsCheckBanBtn');
    const checkAllBtn = document.getElementById('settingsCheckAllTokensBtn');
    
    if (saveBtn && !saveBtn.hasAttribute('data-listener')) {
        saveBtn.addEventListener('click', saveSettings);
        saveBtn.setAttribute('data-listener', 'true');
    }
    if (decodeBtn && !decodeBtn.hasAttribute('data-listener')) {
        decodeBtn.addEventListener('click', () => decodeTokenFromSettings());
        decodeBtn.setAttribute('data-listener', 'true');
    }
    if (checkBanBtn && !checkBanBtn.hasAttribute('data-listener')) {
        checkBanBtn.addEventListener('click', () => checkBanFromSettings());
        checkBanBtn.setAttribute('data-listener', 'true');
    }
    if (checkAllBtn && !checkAllBtn.hasAttribute('data-listener')) {
        checkAllBtn.addEventListener('click', () => checkAllTokensFromSettings());
        checkAllBtn.setAttribute('data-listener', 'true');
    }
    
    // Handle token source radio buttons
    const banSourceRadios = document.querySelectorAll('input[name="banTokenSource"]');
    banSourceRadios.forEach(radio => {
        if (!radio.hasAttribute('data-listener')) {
            radio.addEventListener('change', () => {
                if (banTokenInput) {
                    banTokenInput.disabled = radio.value !== 'manual';
                }
            });
            radio.setAttribute('data-listener', 'true');
        }
    });
}

async function decodeTokenFromSettings() {
    const token = document.getElementById('settingsTokenDecoderInput').value.trim();
    if (!token) {
        showToast('Please enter a token', 'error');
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/decode_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const resultsDisplay = document.getElementById('resultsDisplay');
            if (resultsDisplay) {
                resultsDisplay.textContent = `🔍 Manual Token Decode\n🕐 Time: ${new Date().toLocaleString()}\n\n${'='.repeat(100)}\n\n${data.info}`;
                resultsDisplay.scrollTop = 0;
            }
            showToast('Token decoded successfully!', 'success');
            closeModal();
            await loadAccounts();
            updateAccountDisplay();
            addLogEntry('Token decoded successfully', 'success');
        } else {
            showToast(data.error || 'Failed to decode token', 'error');
        }
    } catch (error) {
        showToast('Error decoding token', 'error');
    } finally {
        showLoading(false);
    }
}

async function checkBanFromSettings() {
    const tokenSource = document.querySelector('input[name="banTokenSource"]:checked').value;
    const tokenInput = document.getElementById('settingsBanTokenInput').value.trim();
    
    if (tokenSource === 'manual' && !tokenInput) {
        showToast('Please enter a token', 'error');
        return;
    }
    
    if (!confirm('⚠️ WARNING: This will effectively security ban all your accounts if your IP is banned on Hypixel!\n\n⚠️ Only proceed if you understand the risks.\n\n⚠️ If your IP gets banned, all accounts checked from this IP will be security banned.\n\nDo you want to continue with the ban check?')) {
        return;
    }
    
    const statusDiv = document.getElementById('banCheckStatus');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking ban status...';
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/ban/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: tokenSource,
                token: tokenInput
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const result = data.banned ? 'BANNED' : 'NOT BANNED';
            const icon = data.banned ? 'fa-times-circle' : 'fa-check-circle';
            const color = data.banned ? 'var(--accent-error)' : 'var(--accent-success)';
            
            statusDiv.innerHTML = `
                <div style="text-align: center;">
                    <i class="fas ${icon}" style="font-size: 2rem; color: ${color}; margin-bottom: 0.5rem;"></i>
                    <h3 style="color: ${color}; margin-bottom: 0.5rem;">${result}</h3>
                    <p style="color: var(--text-secondary);">${data.message}</p>
                </div>
            `;
            
            addLogEntry(`Ban check: ${result}`, data.banned ? 'warning' : 'success');
        } else {
            statusDiv.innerHTML = `<p style="color: var(--accent-error);">Error: ${data.error || 'Failed to check ban status'}</p>`;
        }
    } catch (error) {
        statusDiv.innerHTML = `<p style="color: var(--accent-error);">Error: ${error.message}</p>`;
    } finally {
        showLoading(false);
    }
}

async function checkAllTokensFromSettings() {
    if (state.accounts.length === 0) {
        showToast('No accounts to check', 'warning');
        return;
    }
    
    if (!confirm(`This will check ban status for all ${state.accounts.length} accounts.\n\n⚠️ WARNING: This will effectively security ban all your accounts if your IP is banned on Hypixel!\n\nDo you want to continue?`)) {
        return;
    }
    
    const statusDiv = document.getElementById('banCheckStatus');
    statusDiv.style.display = 'block';
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking all tokens...';
    
    showLoading(true);
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        resultsDisplay.textContent = `🔍 Ban Check Results - All Tokens\n🕐 Time: ${new Date().toLocaleString()}\n\n${'='.repeat(100)}\n\n`;
    }
    
    let checked = 0;
    let banned = 0;
    let notBanned = 0;
    let errors = 0;
    
    for (const account of state.accounts) {
        try {
            const response = await fetch(`${API_BASE}/ban/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'manual',
                    token: account.token
                })
            });
            
            const data = await response.json();
            checked++;
            
            if (data.success) {
                if (data.banned) {
                    banned++;
                    if (resultsDisplay) {
                        resultsDisplay.textContent += `❌ ${account.username}: BANNED\n`;
                    }
                } else {
                    notBanned++;
                    if (resultsDisplay) {
                        resultsDisplay.textContent += `✅ ${account.username}: NOT BANNED\n`;
                    }
                }
            } else {
                errors++;
                if (resultsDisplay) {
                    resultsDisplay.textContent += `⚠️ ${account.username}: ${data.error}\n`;
                }
            }
            
            statusDiv.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Checking ${checked}/${state.accounts.length} accounts...`;
        } catch (error) {
            errors++;
            checked++;
            if (resultsDisplay) {
                resultsDisplay.textContent += `❌ ${account.username}: Error - ${error.message}\n`;
            }
        }
    }
    
    // Summary
    if (resultsDisplay) {
        resultsDisplay.textContent += `\n${'='.repeat(100)}\n`;
        resultsDisplay.textContent += `Summary:\n`;
        resultsDisplay.textContent += `✅ Not Banned: ${notBanned}\n`;
        resultsDisplay.textContent += `❌ Banned: ${banned}\n`;
        resultsDisplay.textContent += `⚠️ Errors: ${errors}\n`;
        resultsDisplay.textContent += `Total Checked: ${checked}\n`;
        resultsDisplay.scrollTop = resultsDisplay.scrollHeight;
    }
    
    statusDiv.innerHTML = `
        <div style="text-align: center;">
            <h3 style="margin-bottom: 0.5rem;">Check Complete</h3>
            <p>✅ Not Banned: ${notBanned}</p>
            <p>❌ Banned: ${banned}</p>
            <p>⚠️ Errors: ${errors}</p>
        </div>
    `;
    
    showToast(`Checked ${checked} accounts. ${banned} banned, ${notBanned} not banned.`, banned > 0 ? 'warning' : 'success');
    addLogEntry(`Checked all tokens: ${banned} banned, ${notBanned} not banned`, banned > 0 ? 'warning' : 'success');
    showLoading(false);
}

function getSettingsModalContent() {
    const hasCurrentAccount = state.currentAccount && state.currentAccount.token;
    
    return `
        <div class="settings-sections">
            <!-- Manual Token Decoder Section -->
            <div class="settings-section">
                <h3><i class="fas fa-code"></i> Manual Token Decoder</h3>
                <div class="form-group-premium">
                    <label class="form-label">Paste Token</label>
                    <p class="form-hint">email:password | token OR just token</p>
                    <textarea id="settingsTokenDecoderInput" class="input-premium" rows="3" placeholder="Paste token here..."></textarea>
                </div>
                <button class="btn-premium-primary" id="settingsDecodeTokenBtn" style="width: 100%; height: 45px;">
                    <i class="fas fa-code"></i> Decode Token
                </button>
            </div>
            
            <!-- Ban Check Section -->
            <div class="settings-section">
                <h3><i class="fas fa-shield-alt"></i> Hypixel Ban Check</h3>
                <div class="form-group-premium">
                    <label class="form-label">Token Source</label>
                    <div class="radio-group">
                        <div class="radio-option">
                            <input type="radio" id="banSourceCurrent" name="banTokenSource" value="current" ${hasCurrentAccount ? 'checked' : ''} ${!hasCurrentAccount ? 'disabled' : ''}>
                            <label for="banSourceCurrent">Use Current Account</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="banSourcePurchased" name="banTokenSource" value="purchased" ${!hasCurrentAccount ? 'checked' : ''} ${!hasCurrentAccount ? 'disabled' : ''}>
                            <label for="banSourcePurchased">Use Purchased Token</label>
                        </div>
                        <div class="radio-option">
                            <input type="radio" id="banSourceManual" name="banTokenSource" value="manual" ${!hasCurrentAccount ? 'checked' : ''}>
                            <label for="banSourceManual">Use Manual Token</label>
                        </div>
                    </div>
                </div>
                <div class="form-group-premium">
                    <label class="form-label">Token (if manual)</label>
                    <textarea id="settingsBanTokenInput" class="input-premium" rows="3" placeholder="Paste token (email:password | token OR just token)" ${hasCurrentAccount ? 'disabled' : ''}></textarea>
                </div>
                <div class="modal-warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p><strong>⚠️ WARNING:</strong> This will effectively security ban all your accounts if your IP is banned on Hypixel! Only proceed if you understand the risks.</p>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn-premium-primary" id="settingsCheckBanBtn" style="flex: 1; height: 45px;">
                        <i class="fas fa-shield-alt"></i> Check Ban Status
                    </button>
                    <button class="btn-premium-secondary" id="settingsCheckAllTokensBtn" style="flex: 1; height: 45px;">
                        <i class="fas fa-shield-alt"></i> Check All Tokens
                    </button>
                </div>
                <div id="banCheckStatus" style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-panel); border-radius: 8px; display: none;"></div>
            </div>
            
            <!-- General Settings Section -->
            <div class="settings-section">
                <h3><i class="fas fa-cog"></i> General</h3>
                <div class="form-group-premium">
                    <label class="checkbox-premium">
                        <input type="checkbox" id="stockNotificationsEnabled" ${state.settings.stock_notifications_enabled !== false ? 'checked' : ''}>
                        <span class="checkbox-slider"></span>
                        <span class="checkbox-label">Stock Notifications</span>
                    </label>
                </div>
                <div class="form-group-premium">
                    <label class="checkbox-premium">
                        <input type="checkbox" id="startupSoundEnabled" ${state.settings.startup_sound_enabled !== false ? 'checked' : ''}>
                        <span class="checkbox-slider"></span>
                        <span class="checkbox-label">Startup Sound</span>
                    </label>
                </div>
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn-premium-primary" id="saveSettingsBtn">
                <i class="fas fa-save"></i> Save Settings
            </button>
        </div>
    `;
}

async function saveSettings() {
    const stockNotifications = document.getElementById('stockNotificationsEnabled').checked;
    const startupSound = document.getElementById('startupSoundEnabled').checked;
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stock_notifications_enabled: stockNotifications,
                startup_sound_enabled: startupSound
            })
        });
        
        if (response.ok) {
            state.settings.stock_notifications_enabled = stockNotifications;
            state.settings.startup_sound_enabled = startupSound;
            showToast('Settings saved successfully', 'success');
            closeModal();
        } else {
            showToast('Error saving settings', 'error');
        }
    } catch (error) {
        showToast('Error saving settings', 'error');
    } finally {
        showLoading(false);
    }
}

// Ban Check Functions
async function openBanCheckModal() {
    const modal = createModal('Check Ban Status', getBanCheckModalContent());
    showModal(modal);
    
    document.getElementById('checkBanSubmitBtn').addEventListener('click', checkBanStatus);
}

function getBanCheckModalContent() {
    return `
        <div class="modal-warning">
            <i class="fas fa-exclamation-triangle"></i>
            <p><strong>WARNING:</strong> This will effectively security ban all your accounts if your IP is banned on Hypixel! Only proceed if you understand the risks.</p>
        </div>
        
        <div class="form-group-premium">
            <label class="form-label">Token Source</label>
            <select id="banTokenSource" class="input-premium select-premium">
                <option value="current">Use Current Account</option>
                <option value="purchased">Use Purchased Token</option>
                <option value="manual">Manual Token</option>
            </select>
        </div>
        
        <div class="form-group-premium">
            <label class="form-label">Token (if manual)</label>
            <textarea id="banTokenInput" class="input-premium" rows="3" placeholder="Paste token here..."></textarea>
        </div>
        
        <div class="modal-actions">
            <button class="btn-premium-primary" id="checkBanSubmitBtn">
                <i class="fas fa-shield-alt"></i> Check Ban Status
            </button>
        </div>
    `;
}

async function checkBanStatus() {
    const tokenSource = document.getElementById('banTokenSource').value;
    const tokenInput = document.getElementById('banTokenInput').value.trim();
    
    if (tokenSource === 'manual' && !tokenInput) {
        showToast('Please enter a token', 'error');
        return;
    }
    
    if (!confirm('⚠️ WARNING: This will effectively security ban all your accounts if your IP is banned on Hypixel!\n\n⚠️ Only proceed if you understand the risks.\n\n⚠️ If your IP gets banned, all accounts checked from this IP will be security banned.\n\nDo you want to continue with the ban check?')) {
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/ban/check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: tokenSource,
                token: tokenInput
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const result = data.banned ? 'BANNED' : 'NOT BANNED';
            const icon = data.banned ? 'fa-times-circle' : 'fa-check-circle';
            const color = data.banned ? 'var(--accent-error)' : 'var(--accent-success)';
            
            const content = document.getElementById('banCheckResultContent');
            if (content) {
                content.innerHTML = `
                    <i class="fas ${icon}" style="font-size: 4rem; color: ${color}; margin-bottom: 1rem;"></i>
                    <h2 style="color: ${color}; margin-bottom: 1rem;">${result}</h2>
                    <p>${data.message}</p>
                `;
                showModalById('banCheckResultModal');
            } else {
                const modal = createModal('Ban Check Result', `
                    <div style="text-align: center; padding: 2rem;">
                        <i class="fas ${icon}" style="font-size: 4rem; color: ${color}; margin-bottom: 1rem;"></i>
                        <h2 style="color: ${color}; margin-bottom: 1rem;">${result}</h2>
                        <p>${data.message}</p>
                    </div>
                `);
                showModal(modal);
            }
            addLogEntry(`Ban check: ${result}`, data.banned ? 'warning' : 'success');
        } else {
            showToast(data.error || 'Failed to check ban status', 'error');
        }
    } catch (error) {
        showToast('Error checking ban status', 'error');
    } finally {
        showLoading(false);
    }
}

// Token Decoder Functions
async function openTokenDecoderModal() {
    const modal = createModal('Token Decoder', getTokenDecoderModalContent());
    showModal(modal);
    
    document.getElementById('decodeTokenSubmitBtn').addEventListener('click', decodeToken);
}

function getTokenDecoderModalContent() {
    return `
        <div class="form-group-premium">
            <label class="form-label">
                <i class="fas fa-key"></i>
                Token
            </label>
            <p class="form-hint">Paste token (email:password | token OR just token)</p>
            <textarea id="decodeTokenInput" class="input-premium" rows="5" placeholder="Paste token here..."></textarea>
        </div>
        
        <div class="modal-actions">
            <button class="btn-premium-primary" id="decodeTokenSubmitBtn">
                <i class="fas fa-code"></i> Decode Token
            </button>
        </div>
    `;
}

async function decodeToken() {
    const token = document.getElementById('decodeTokenInput').value.trim();
    if (!token) {
        showToast('Please enter a token', 'error');
        return;
    }
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/account/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const content = document.getElementById('tokenDecodedContent');
            if (content) {
                content.textContent = data.info;
                showModalById('tokenDecodedModal');
            } else {
                const modal = createModal('Token Decoded', `
                    <div class="account-info-display">
                        <pre style="white-space: pre-wrap; font-family: 'JetBrains Mono', monospace; background: var(--bg-panel); padding: 1rem; border-radius: 8px; overflow-x: auto; max-height: 500px; overflow-y: auto;">${data.info}</pre>
                    </div>
                `);
                showModal(modal);
            }
            addLogEntry('Token decoded successfully', 'success');
        } else {
            showToast(data.error || 'Failed to decode token', 'error');
        }
    } catch (error) {
        showToast('Error decoding token', 'error');
    } finally {
        showLoading(false);
    }
}

// Chat Functions
async function loadChatMessages() {
    if (!state.chatEnabled) return;
    
    try {
        const response = await fetch(`${API_BASE}/chat/recent`);
        const data = await response.json();
        if (data.success && data.messages) {
            state.chatMessages = data.messages;
            updateChatDisplay();
        }
    } catch (error) {
        console.error('Error loading chat messages:', error);
    }
}

function startChatPolling() {
    if (!state.chatEnabled) return;
    
    setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE}/chat/recent`);
            const data = await response.json();
            if (data.success && data.messages) {
                const newMessages = data.messages.filter(msg => 
                    !state.chatMessages.some(existing => existing.id === msg.id)
                );
                if (newMessages.length > 0) {
                    state.chatMessages = data.messages;
                    updateChatDisplay();
                }
            }
        } catch (error) {
            console.error('Error polling chat:', error);
        }
    }, 3000);
}

function updateChatDisplay() {
    const chatDisplay = document.getElementById('chatDisplay');
    if (!chatDisplay) return;
    
    let html = '';
    state.chatMessages.slice().reverse().forEach(msg => {
        html += `
            <div class="chat-message">
                <span class="chat-time">[${msg.timestamp}]</span>
                <span class="chat-username">${msg.username}:</span>
                <span class="chat-text">${msg.message}</span>
            </div>
        `;
    });
    chatDisplay.innerHTML = html;
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    input.value = '';
    
    try {
        const response = await fetch(`${API_BASE}/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            // Message sent, will appear in next poll
            await loadChatMessages();
        } else {
            showToast('Failed to send message', 'error');
        }
    } catch (error) {
        showToast('Error sending message', 'error');
    }
}

// Modal Functions
function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-premium">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="btn-icon-modal" onclick="closeModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-content">
                ${content}
            </div>
        </div>
    `;
    return modal;
}

function showModal(modal) {
    if (currentModal) {
        currentModal.remove();
    }
    currentModal = modal;
    document.body.appendChild(modal);
    
    gsap.from(modal.querySelector('.modal-premium'), {
        opacity: 0,
        scale: 0.9,
        duration: 0.3,
        ease: 'back.out(1.7)'
    });
}

function closeModal() {
    if (currentModal) {
        gsap.to(currentModal.querySelector('.modal-premium'), {
            opacity: 0,
            scale: 0.9,
            duration: 0.2,
            ease: 'power2.in',
            onComplete: () => {
                currentModal.remove();
                currentModal = null;
            }
        });
    }
}

// Utility Functions
function clearResults() {
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (!resultsDisplay) return;
    
    resultsDisplay.innerHTML = `
        <div class="welcome-state">
            <i class="fas fa-rocket"></i>
            <h3>Welcome to NiceAlts Manager</h3>
            <p>Account details will appear here after purchasing accounts.</p>
        </div>
    `;
    addLogEntry('Results cleared', 'info');
}

function clearLog() {
    state.activityLog = [];
    const log = document.getElementById('activityLog');
    if (!log) return;
    
    log.innerHTML = `
        <div class="log-entry info">
            <i class="fas fa-info-circle"></i>
            <span>Activity log cleared</span>
            <span class="log-time">Just now</span>
        </div>
    `;
}

function addLogEntry(message, type = 'info') {
    const log = document.getElementById('activityLog');
    if (!log) return;
    
    const time = new Date().toLocaleTimeString();
    const icons = {
        info: 'fa-info-circle',
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
        <span class="log-time">${time}</span>
    `;
    
    log.insertBefore(entry, log.firstChild);
    
    // Keep only last 50 entries
    while (log.children.length > 50) {
        log.removeChild(log.lastChild);
    }
    
    // Animate entry
    gsap.from(entry, {
        opacity: 0,
        x: -20,
        duration: 0.3,
        ease: 'power2.out'
    });
}

function updateStats() {
    // Update accounts stat
    const accountsStat = document.getElementById('accountsStat');
    if (accountsStat) {
        accountsStat.textContent = state.accounts.length || 0;
    }
    
    // Update activity stat
    const activityStat = document.getElementById('activityStat');
    if (activityStat) {
        const recentActivity = state.activityLog.length > 0 ? 'Active' : 'Ready';
        activityStat.textContent = recentActivity;
    }
    
    // Always update account display when stats update
    updateAccountDisplay();
}

function toggleApiKeyVisibility() {
    const input = document.getElementById('apiKey');
    const button = document.getElementById('toggleApiKey');
    if (!input || !button) return;
    
    const icon = button.querySelector('i');
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

async function checkAllTokens() {
    if (state.accounts.length === 0) {
        showToast('No accounts to check', 'warning');
        return;
    }
    
    if (!confirm(`This will check ban status for all ${state.accounts.length} accounts.\n\n⚠️ WARNING: This will effectively security ban all your accounts if your IP is banned on Hypixel!\n\nDo you want to continue?`)) {
        return;
    }
    
    showLoading(true);
    const resultsDisplay = document.getElementById('resultsDisplay');
    if (resultsDisplay) {
        resultsDisplay.textContent = `🔍 Checking ${state.accounts.length} accounts...\n\n`;
    }
    
    let checked = 0;
    let banned = 0;
    let notBanned = 0;
    let errors = 0;
    
    for (const account of state.accounts) {
        try {
            const response = await fetch(`${API_BASE}/ban/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source: 'manual',
                    token: account.token
                })
            });
            
            const data = await response.json();
            checked++;
            
            if (data.success) {
                if (data.banned) {
                    banned++;
                    if (resultsDisplay) {
                        resultsDisplay.textContent += `❌ ${account.username}: BANNED\n`;
                    }
                } else {
                    notBanned++;
                    if (resultsDisplay) {
                        resultsDisplay.textContent += `✅ ${account.username}: NOT BANNED\n`;
                    }
                }
            } else {
                errors++;
                if (resultsDisplay) {
                    resultsDisplay.textContent += `⚠️ ${account.username}: ${data.error}\n`;
                }
            }
            
            // Update progress
            if (resultsDisplay) {
                resultsDisplay.textContent = resultsDisplay.textContent.replace(
                    /🔍 Checking \d+ accounts\.\.\./,
                    `🔍 Checking ${state.accounts.length} accounts... (${checked}/${state.accounts.length})`
                );
            }
        } catch (error) {
            errors++;
            checked++;
            if (resultsDisplay) {
                resultsDisplay.textContent += `❌ ${account.username}: Error - ${error.message}\n`;
            }
        }
    }
    
    // Summary
    if (resultsDisplay) {
        resultsDisplay.textContent += `\n${'='.repeat(60)}\n`;
        resultsDisplay.textContent += `Summary:\n`;
        resultsDisplay.textContent += `✅ Not Banned: ${notBanned}\n`;
        resultsDisplay.textContent += `❌ Banned: ${banned}\n`;
        resultsDisplay.textContent += `⚠️ Errors: ${errors}\n`;
        resultsDisplay.textContent += `Total Checked: ${checked}\n`;
        resultsDisplay.scrollTop = resultsDisplay.scrollHeight;
    }
    
    showToast(`Checked ${checked} accounts. ${banned} banned, ${notBanned} not banned.`, banned > 0 ? 'warning' : 'success');
    addLogEntry(`Checked all tokens: ${banned} banned, ${notBanned} not banned`, banned > 0 ? 'warning' : 'success');
    showLoading(false);
}

function exportData() {
    const data = {
        balance: state.balance,
        stock: state.stock,
        accounts: state.accounts,
        exported_at: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nicealts-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Data exported successfully', 'success');
    addLogEntry('Data exported', 'success');
}

async function openChatSettingsModal() {
    await loadSettings();
    
    // Update form values
    const chatNameInput = document.getElementById('chatNameSetting');
    const geminiKeyInput = document.getElementById('geminiApiKeySetting');
    if (chatNameInput) chatNameInput.value = state.chatName || '';
    if (geminiKeyInput) geminiKeyInput.value = state.geminiApiKey || '';
    
    showModalById('chatSettingsModal');
    
    const saveBtn = document.getElementById('saveChatSettingsBtn');
    const cancelBtn = document.getElementById('cancelChatSettingsBtn');
    const toggleBtn = document.getElementById('toggleGeminiKey');
    
    if (saveBtn && !saveBtn.hasAttribute('data-listener')) {
        saveBtn.addEventListener('click', saveChatSettings);
        saveBtn.setAttribute('data-listener', 'true');
    }
    if (cancelBtn && !cancelBtn.hasAttribute('data-listener')) {
        cancelBtn.addEventListener('click', closeModal);
        cancelBtn.setAttribute('data-listener', 'true');
    }
    if (toggleBtn && !toggleBtn.hasAttribute('data-listener')) {
        toggleBtn.addEventListener('click', () => {
            if (geminiKeyInput) {
                geminiKeyInput.type = geminiKeyInput.type === 'password' ? 'text' : 'password';
            }
        });
        toggleBtn.setAttribute('data-listener', 'true');
    }
}

function getChatSettingsModalContent() {
    return `
        <div class="settings-sections">
            <!-- Custom Name Section -->
            <div class="settings-section">
                <h3><i class="fas fa-user"></i> Custom Display Name</h3>
                <p class="form-hint">Leave empty to use your Minecraft username</p>
                <input type="text" id="chatNameSetting" class="input-premium" value="${state.chatName || ''}" placeholder="Enter custom name (optional)">
            </div>
            
            <!-- Gemini API Key Section -->
            <div class="settings-section">
                <h3><i class="fas fa-robot"></i> AI Chatbot (Google Gemini)</h3>
                <p class="form-hint">Optional: Add a free Google Gemini API key for better AI responses. Get one at: https://aistudio.google.com/app/apikey</p>
                <div class="input-wrapper">
                    <input type="password" id="geminiApiKeySetting" class="input-premium" value="${state.geminiApiKey || ''}" placeholder="Enter Gemini API key (optional, free tier available)">
                    <button class="input-action" id="toggleGeminiKey" type="button" title="Toggle visibility">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            
            <!-- Security Warning -->
            <div class="modal-warning">
                <i class="fas fa-exclamation-triangle"></i>
                <p><strong>⚠️ Security:</strong> Chat is UNOFFICIAL and may be insecure. DO NOT share personal information, passwords, tokens, or email addresses.</p>
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn-premium-secondary" id="cancelChatSettingsBtn">
                <i class="fas fa-times"></i> Cancel
            </button>
            <button class="btn-premium-primary" id="saveChatSettingsBtn">
                <i class="fas fa-save"></i> Save Settings
            </button>
        </div>
    `;
}

async function saveChatSettings() {
    const chatName = document.getElementById('chatNameSetting').value.trim().substring(0, 50);
    const geminiApiKey = document.getElementById('geminiApiKeySetting').value.trim();
    
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_name: chatName,
                gemini_api_key: geminiApiKey
            })
        });
        
        if (response.ok) {
            state.chatName = chatName;
            state.geminiApiKey = geminiApiKey;
            
            showToast('Chat settings saved successfully', 'success');
            closeModal();
        } else {
            showToast('Error saving chat settings', 'error');
        }
    } catch (error) {
        showToast('Error saving chat settings', 'error');
    } finally {
        showLoading(false);
    }
}

// Auto-refresh
function startAutoRefresh() {
    // Refresh stock every 60 seconds
    setInterval(async () => {
        if (state.apiKey) {
            await checkStock();
        }
    }, 60000);
    
    // Refresh balance every 5 minutes
    setInterval(async () => {
        if (state.apiKey) {
            await checkBalance();
        }
    }, 300000);
}

// Loading Overlay
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// Toast Notification System
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-premium ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <div class="toast-content">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Animate in
    gsap.from(toast, {
        opacity: 0,
        x: 100,
        duration: 0.3,
        ease: 'back.out(1.7)'
    });
    
    // Remove after 4 seconds
    setTimeout(() => {
        gsap.to(toast, {
            opacity: 0,
            x: 100,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => toast.remove()
        });
    }, 4000);
}
