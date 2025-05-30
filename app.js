/**
 * Team Balancer App
 * 
 * UI controller for the Team Balancer application
 * Connects the HTML interface with the TeamBalancer module
 */

document.addEventListener('DOMContentLoaded', function() {
    // DOM References
    const playersContainer = document.getElementById('players-container');
    const addPlayerBtn = document.getElementById('add-player');
    const numTeamsInput = document.getElementById('num-teams');
    const generateTeamsBtn = document.getElementById('generate-teams');
    const resetFormBtn = document.getElementById('reset-form');
    const inputErrorDisplay = document.getElementById('input-error');
    const resultsContainer = document.getElementById('results-container');
    const teamsDisplay = document.getElementById('teams-display');
    const copyResultsBtn = document.getElementById('copy-results');
    const downloadResultsBtn = document.getElementById('download-results');
    const csvFileInput = document.getElementById('csv-file-input');
    const browseFilesBtn = document.getElementById('browse-files');
    const downloadTemplateBtn = document.getElementById('download-template');
    const csvPreview = document.getElementById('csv-preview');
    const fileUploadArea = document.getElementById('file-upload-area');
    const metricsDisplay = {
        strengthVariance: document.getElementById('strength-variance'),
        strengthDiff: document.getElementById('strength-diff'),
        tierImbalance: document.getElementById('tier-imbalance'),
        overallScore: document.getElementById('overall-score')
    };

    // State variables
    let csvData = null;
    let currentResults = null;
    let activeInputMethod = 'manual'; // 'manual' or 'csv'

    // Initialize with first player row
    initializeApp();

    /**
     * Initialize the application
     */
    function initializeApp() {
        // Clear any existing player rows and add a single empty row
        playersContainer.innerHTML = '';
        addPlayerRow();
        
        // Reset error messages
        setErrorMessage('');
        
        // Add event listeners
        setupEventListeners();
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Player management
        addPlayerBtn.addEventListener('click', addPlayerRow);
        playersContainer.addEventListener('click', handlePlayerRowClicks);
        
        // Team generation
        generateTeamsBtn.addEventListener('click', generateTeams);
        resetFormBtn.addEventListener('click', resetForm);
        
        // Results actions
        copyResultsBtn.addEventListener('click', copyResultsToClipboard);
        downloadResultsBtn.addEventListener('click', downloadResults);
        
        // CSV handling
        csvFileInput.addEventListener('change', handleFileSelect);
        browseFilesBtn.addEventListener('click', () => csvFileInput.click());
        downloadTemplateBtn.addEventListener('click', downloadTemplate);
        
        // Tab switching
        document.getElementById('tab-manual').addEventListener('click', () => {
            activeInputMethod = 'manual';
        });
        
        document.getElementById('tab-csv').addEventListener('click', () => {
            activeInputMethod = 'csv';
        });
        
        // File drop handling
        fileUploadArea.addEventListener('drop', handleFileDrop);
    }

    /**
     * Add a new player row to the manual entry form
     */
    function addPlayerRow() {
        const playerRow = document.createElement('div');
        playerRow.className = 'player-row';
        
        // Create name input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Player Name';
        nameInput.required = true;
        
        // Create tier select
        const tierSelect = document.createElement('select');
        tierSelect.required = true;
        
        // Add default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Tier';
        defaultOption.disabled = true;
        defaultOption.selected = true;
        tierSelect.appendChild(defaultOption);
        
        // Add tier options
        const tiers = Array.from(TeamBalancer.VALID_TIERS);
        tiers.sort((a, b) => {
            // Custom sort to keep tiers in order from highest to lowest
            const tierOrder = {
                'S+': 0, 'S': 1, 'S/A': 2, 'A': 3, 'A/B': 4, 'B': 5, 'C': 6, 'D': 7, 'F': 8
            };
            return tierOrder[a] - tierOrder[b];
        });
        
        tiers.forEach(tier => {
            const option = document.createElement('option');
            option.value = tier;
            option.textContent = tier;
            tierSelect.appendChild(option);
        });
        
        // Create captain checkbox container
        const captainCheck = document.createElement('div');
        captainCheck.className = 'captain-check';
        
        // Create captain checkbox
        const captainCheckbox = document.createElement('input');
        captainCheckbox.type = 'checkbox';
        captainCheckbox.title = 'Team Captain';
        
        // Create captain label
        const captainLabel = document.createElement('span');
        captainLabel.textContent = 'Captain';
        
        // Assemble captain checkbox and label
        captainCheck.appendChild(captainCheckbox);
        captainCheck.appendChild(captainLabel);
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'danger';
        removeBtn.title = 'Remove player';
        removeBtn.textContent = '-';
        removeBtn.dataset.action = 'remove-player';
        
        // Append elements to row
        playerRow.appendChild(nameInput);
        playerRow.appendChild(tierSelect);
        playerRow.appendChild(captainCheck);
        playerRow.appendChild(removeBtn);
        
        // Append row to container
        playersContainer.appendChild(playerRow);
    }

    /**
     * Handle clicks on player rows (specifically remove buttons)
     * @param {Event} e - Click event
     */
    function handlePlayerRowClicks(e) {
        if (e.target.dataset.action === 'remove-player') {
            // Don't remove the last player row
            if (playersContainer.children.length > 1) {
                e.target.closest('.player-row').remove();
            }
        }
    }

    /**
     * Handle file selection for CSV upload
     * @param {Event} e - Change event
     */
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        parseCSVFile(file);
    }

    /**
     * Handle file drop for CSV upload
     * @param {Event} e - Drop event
     */
    function handleFileDrop(e) {
        e.preventDefault();
        
        if (e.dataTransfer.items) {
            for (let i = 0; i < e.dataTransfer.items.length; i++) {
                if (e.dataTransfer.items[i].kind === 'file') {
                    const file = e.dataTransfer.items[i].getAsFile();
                    if (file.name.endsWith('.csv')) {
                        parseCSVFile(file);
                        break;
                    } else {
                        setErrorMessage('Please upload a CSV file');
                    }
                }
            }
        } else {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                const file = e.dataTransfer.files[i];
                if (file.name.endsWith('.csv')) {
                    parseCSVFile(file);
                    break;
                } else {
                    setErrorMessage('Please upload a CSV file');
                }
            }
        }
    }

    /**
     * Parse a CSV file and display its contents
     * @param {File} file - The CSV file to parse
     */
    function parseCSVFile(file) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                csvData = content;
                
                // Display preview
                displayCSVPreview(content);
                
                // Clear any error messages
                setErrorMessage('');
            } catch (error) {
                setErrorMessage(`Error parsing CSV: ${error.message}`);
                csvData = null;
            }
        };
        
        reader.onerror = function() {
            setErrorMessage('Error reading file');
            csvData = null;
        };
        
        reader.readAsText(file);
    }

    /**
     * Validate captain count against number of teams
     * @param {HTMLElement} checkbox - The checkbox that was changed
     * @returns {boolean} Whether the validation passed
     */
    function validateCaptainCount(checkbox) {
        const numTeams = parseInt(numTeamsInput.value, 10);
        const table = checkbox.closest('table');
        const captainCheckboxes = table.querySelectorAll('.captain-checkbox');
        let captainCount = 0;
        
        captainCheckboxes.forEach(cb => {
            if (cb.checked) captainCount++;
        });
        
        if (captainCount > numTeams) {
            checkbox.checked = false;
            showToast(`Cannot have more captains (${captainCount}) than teams (${numTeams})`, true);
            return false;
        }
        
        return true;
    }
    
    /**
     * Display a preview of the CSV data
     * @param {string} content - CSV content as string
     */
    function displayCSVPreview(content) {
        try {
            const lines = content.split(/\r?\n/);
            if (lines.length === 0) {
                throw new Error('CSV file is empty');
            }
            
            // Create a container for the scrollable table with sticky header
            const tableContainer = document.createElement('div');
            tableContainer.className = 'csv-table-container';
            tableContainer.style.maxHeight = '400px';
            tableContainer.style.overflowY = 'auto';
            tableContainer.style.position = 'relative';
            tableContainer.style.marginBottom = '15px';
            tableContainer.style.border = '1px solid #ddd';
            tableContainer.style.borderRadius = '4px';
            
            // Create table for preview
            const table = document.createElement('table');
            table.classList.add('csv-preview-table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            
            // Create header row
            const headerRow = document.createElement('tr');
            const headerColumns = lines[0].split(',');
            
            // Find if there's a captain column and its index
            const captainColIndex = headerColumns.findIndex(col => 
                col.trim().toLowerCase() === 'captain');
            
            // Apply header style with captain status emphasis
            headerColumns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col.trim();
                th.style.position = 'sticky';
                th.style.top = '0';
                th.style.backgroundColor = '#f9f9f9';
                th.style.borderBottom = '2px solid #ddd';
                th.style.padding = '10px';
                th.style.zIndex = '1';
                
                if (col.trim().toLowerCase() === 'captain') {
                    th.style.color = 'var(--primary-color)';
                    th.style.fontWeight = 'bold';
                }
                headerRow.appendChild(th);
            });
            
            // Add manual captain column if it doesn't exist
            if (captainColIndex === -1) {
                const captainHeader = document.createElement('th');
                captainHeader.textContent = 'Captain';
                captainHeader.style.color = 'var(--primary-color)';
                captainHeader.style.fontWeight = 'bold';
                captainHeader.style.position = 'sticky';
                captainHeader.style.top = '0';
                captainHeader.style.backgroundColor = '#f9f9f9';
                captainHeader.style.borderBottom = '2px solid #ddd';
                captainHeader.style.padding = '10px';
                captainHeader.style.zIndex = '1';
                headerRow.appendChild(captainHeader);
            }
            
            table.appendChild(headerRow);
            
            // Create data rows - show ALL rows, not just 10
            let validRowCount = 0;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                validRowCount++;
                const row = document.createElement('tr');
                row.dataset.playerIndex = i - 1; // Store player index for later reference
                const columns = line.split(',');
                
                // Apply alternating row colors for better readability
                if (validRowCount % 2 === 0) {
                    row.style.backgroundColor = '#f5f5f5';
                }
                
                columns.forEach((col, index) => {
                    const td = document.createElement('td');
                    td.style.padding = '8px';
                    td.style.borderBottom = '1px solid #ddd';
                    
                    const value = col.trim();
                    
                    // Special handling for captain column
                    if (headerColumns[index].trim().toLowerCase() === 'captain') {
                        const isCaptain = value.toLowerCase() === 'true' || 
                                          value === '1' || 
                                          value.toLowerCase() === 'yes';
                        
                        // Create checkbox for captain status
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.className = 'captain-checkbox';
                        checkbox.checked = isCaptain;
                        checkbox.addEventListener('change', function() {
                            validateCaptainCount(this);
                        });
                        
                        td.appendChild(checkbox);
                    } else {
                        td.textContent = value;
                    }
                    
                    row.appendChild(td);
                });
                
                // Add manual captain checkbox if no captain column exists
                if (captainColIndex === -1) {
                    const captainTd = document.createElement('td');
                    captainTd.style.padding = '8px';
                    captainTd.style.borderBottom = '1px solid #ddd';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.className = 'captain-checkbox';
                    checkbox.addEventListener('change', function() {
                        validateCaptainCount(this);
                    });
                    captainTd.appendChild(checkbox);
                    row.appendChild(captainTd);
                }
                
                table.appendChild(row);
            }
            
            // Add table to container
            tableContainer.appendChild(table);
            
            // Update preview area
            csvPreview.innerHTML = '';
            csvPreview.appendChild(tableContainer);
            
            // Add row count info
            const rowInfo = document.createElement('p');
            const nonEmptyLines = lines.filter((line, index) => index > 0 && line.trim());
            rowInfo.textContent = `Total players: ${nonEmptyLines.length} rows shown`;
            csvPreview.appendChild(rowInfo);
            
            // Add hint about captain selection
            const captainHint = document.createElement('p');
            captainHint.className = 'description';
            captainHint.textContent = 'You can check/uncheck captain boxes to designate team captains. The number of captains cannot exceed the number of teams.';
            csvPreview.appendChild(captainHint);
        } catch (error) {
            csvPreview.innerHTML = `<p class="error-message">Error previewing CSV: ${error.message}</p>`;
        }
    }

    /**
     * Generate teams based on current input
     */
    function generateTeams() {
        try {
            // Clear any previous error messages
            setErrorMessage('');
            
            // Get number of teams
            const numTeams = parseInt(numTeamsInput.value, 10);
            if (isNaN(numTeams) || numTeams < 2) {
                throw new Error('Number of teams must be at least 2');
            }
            
            // Get selected strategy
            const strategyElements = document.getElementsByName('strategy');
            let selectedStrategy = 'round_robin'; // Default
            
            for (const element of strategyElements) {
                if (element.checked) {
                    selectedStrategy = element.value;
                    break;
                }
            }
            
            // Get players based on active input method
            let players = [];
            
            if (activeInputMethod === 'manual') {
                players = getPlayersFromForm();
            } else {
                players = getPlayersFromCSV();
            }
            
            // Validate player count
            const playersPerTeam = TeamBalancer.validatePlayerCount(players, numTeams);
            
            // Create team distribution
            const distribution = TeamBalancer.createTeamDistribution(
                selectedStrategy,
                players,
                numTeams,
                playersPerTeam
            );
            
            // Store results for later use
            currentResults = distribution;
            
            // Display results
            displayResults(distribution);
            
            // Show results container
            resultsContainer.classList.add('active');
            
            // Scroll to results
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            setErrorMessage(error.message);
            resultsContainer.classList.remove('active');
        }
    }

    /**
     * Get players from the manual entry form
     * @returns {Array<Player>} Array of Player objects
     */
    function getPlayersFromForm() {
        const players = [];
        const playerRows = playersContainer.querySelectorAll('.player-row');
        const seenNames = new Set();
        const numTeams = parseInt(numTeamsInput.value, 10);
        let captainCount = 0;
        
        for (const row of playerRows) {
            const nameInput = row.querySelector('input[type="text"]');
            const tierSelect = row.querySelector('select');
            const captainCheckbox = row.querySelector('.captain-check input[type="checkbox"]');
            
            const name = nameInput.value.trim();
            const tier = tierSelect.value;
            const isCaptain = captainCheckbox.checked;
            
            if (isCaptain) {
                captainCount++;
                if (captainCount > numTeams) {
                    throw new Error(`Cannot have more captains (${captainCount}) than teams (${numTeams})`);
                }
            }
            
            // Validate player
            const validation = TeamBalancer.validatePlayer(name, tier);
            if (!validation.isValid) {
                throw new Error(validation.message);
            }
            
            // Check for duplicate names
            if (seenNames.has(name)) {
                throw new Error(`Duplicate player name: ${name}`);
            }
            
            players.push(new TeamBalancer.Player(name, tier, isCaptain));
            seenNames.add(name);
        }
        
        if (players.length === 0) {
            throw new Error('No players provided');
        }
        
        return players;
    }

    /**
     * Get players from the CSV data
     * @returns {Array<Player>} Array of Player objects
     */
    function getPlayersFromCSV() {
        if (!csvData) {
            throw new Error('No CSV data provided');
        }
        
        // Get basic player data from CSV
        const players = TeamBalancer.loadPlayersFromCSV(csvData);
        
        if (players.length === 0) {
            throw new Error('No valid players found in CSV');
        }
        
        try {
            // Update captain status from UI checkboxes
            const table = csvPreview.querySelector('.csv-preview-table');
            if (!table) {
                console.warn('CSV preview table not found');
                return players;
            }
            
            const rows = table.querySelectorAll('tr');
            if (rows.length < 2) { // Need at least header + 1 data row
                console.warn('No data rows found in CSV preview');
                return players;
            }
            
            // Get header cells to find the name column
            const headerRow = rows[0];
            const headerCells = Array.from(headerRow.cells).map(cell => 
                cell.textContent.trim().toLowerCase()
            );
            
            // Find name column index
            const nameColIndex = headerCells.indexOf('name');
            if (nameColIndex === -1) {
                console.warn('Name column not found in CSV preview');
                return players;
            }
            
            // Create a case-insensitive map of player names to player objects
            const playerMap = new Map(
                players.map(player => [player.name.toLowerCase(), player])
            );
            
            // Track captain count
            let captainCount = 0;
            const numTeams = parseInt(numTeamsInput.value, 10);
            const captainUpdates = []; // For logging purposes
            
            // First pass - count existing captains from original data
            players.forEach(player => {
                if (player.isCaptain) captainCount++;
            });
            
            console.log(`Initial captain count: ${captainCount}`);
            
            // Second pass - process each data row (skip header)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row.cells || row.cells.length <= nameColIndex) continue;
                
                const nameCell = row.cells[nameColIndex];
                if (!nameCell) continue;
                
                const name = nameCell.textContent.trim();
                if (!name) continue;
                
                // Find player by name (case insensitive)
                const player = playerMap.get(name.toLowerCase());
                if (!player) {
                    console.warn(`Player not found for name: ${name}`);
                    continue;
                }
                
                // Get captain checkbox
                const captainCheckbox = row.querySelector('.captain-checkbox');
                if (!captainCheckbox) {
                    console.warn(`Captain checkbox not found for player: ${name}`);
                    continue;
                }
                
                // Update captain status
                const wasCaptain = player.isCaptain;
                const willBeCaptain = captainCheckbox.checked;
                
                // Only update if there's a change
                if (wasCaptain !== willBeCaptain) {
                    // Calculate new captain count before making changes
                    const newCaptainCount = willBeCaptain ? captainCount + 1 : captainCount - 1;
                    
                    // Validate captain count
                    if (willBeCaptain && newCaptainCount > numTeams) {
                        // Revert the checkbox state without updating player
                        captainCheckbox.checked = false;
                        console.warn(`Prevented excess captain: ${newCaptainCount} vs ${numTeams} teams`);
                        
                        // Don't throw here, just prevent the change
                        showToast(`Cannot have more captains (${numTeams + 1}) than teams (${numTeams})`, true);
                        continue;
                    }
                    
                    // Apply the change to player object
                    player.isCaptain = willBeCaptain;
                    
                    // Update captain count after successful change
                    captainCount = newCaptainCount;
                    
                    // Log the change
                    const changeType = willBeCaptain ? 'added' : 'removed';
                    captainUpdates.push(`${name}: ${changeType}`);
                    console.log(`Captain ${changeType} for ${name} (total: ${captainCount}/${numTeams})`);
                }
            }
            
            // Log captain updates
            if (captainUpdates.length > 0) {
                console.log(`Captain updates: ${captainUpdates.join(', ')}`);
            }
            console.log(`Final captain count: ${captainCount} of ${numTeams} teams`);
            
            return players;
            
        } catch (error) {
            console.error('Error updating captain status:', error);
            throw new Error(`Failed to update captain status: ${error.message}`);
        }
    }

    /**
     * Display the results of team generation
     * @param {TeamDistribution} distribution - Team distribution object
     */
    function displayResults(distribution) {
        // Format teams for display
        const formattedTeams = TeamBalancer.formatTeamsForDisplay(distribution.teams);
        
        // Clear previous results
        teamsDisplay.innerHTML = '';
        
        // Add dynamic styling for captain highlights
        const captainStyle = document.createElement('style');
        captainStyle.textContent = `
            .player-captain {
                font-weight: bold;
                color: var(--primary-color);
                font-size: 1.1em;
            }
            
            .captain-indicator {
                color: var(--primary-color);
                margin-right: 8px;
                font-size: 1.2em;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
            }
            
            .captain-row {
                background: linear-gradient(to right, rgba(52, 152, 219, 0.15), rgba(52, 152, 219, 0.05));
                border-left: 3px solid var(--primary-color);
                border-radius: 4px;
                padding: 8px !important;
                margin: 4px 0;
            }
            
            .captain-badge {
                background-color: var(--primary-color);
                color: white;
                font-size: 0.75em;
                padding: 3px 8px;
                border-radius: 12px;
                margin-left: 8px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: bold;
                display: inline-block;
                vertical-align: middle;
                box-shadow: 1px 1px 3px rgba(0,0,0,0.1);
            }
            
            .team-players li {
                transition: background-color 0.2s ease;
            }
            
            .team-players li:hover {
                background-color: rgba(52, 152, 219, 0.05);
            }
            
            .team-players li.captain-row:hover {
                background: linear-gradient(to right, rgba(52, 152, 219, 0.2), rgba(52, 152, 219, 0.1));
            }
        `;
        document.head.appendChild(captainStyle);
        
        // Add teams to display
        formattedTeams.forEach(team => {
            const teamCard = document.createElement('div');
            teamCard.className = 'team-card';
            
            const teamHeader = document.createElement('div');
            teamHeader.className = 'team-header';
            
            const teamTitle = document.createElement('span');
            teamTitle.textContent = `Team ${team.teamNumber}`;
            
            const teamStrength = document.createElement('span');
            teamStrength.textContent = `Strength: ${team.totalStrength}`;
            
            teamHeader.appendChild(teamTitle);
            teamHeader.appendChild(teamStrength);
            
            const playersList = document.createElement('ul');
            playersList.className = 'team-players';
            
            team.players.forEach(player => {
                const playerItem = document.createElement('li');
                
                // Apply special styling to captain row
                if (player.isCaptain) {
                    playerItem.classList.add('captain-row');
                }
                
                const playerInfo = document.createElement('span');
                
                // Add star indicator for captains
                if (player.isCaptain) {
                    const captainIndicator = document.createElement('span');
                    captainIndicator.className = 'captain-indicator';
                    captainIndicator.innerHTML = '★'; // Star symbol
                    playerInfo.appendChild(captainIndicator);
                }
                
                // Create player name with special styling for captains
                const playerName = document.createElement('span');
                playerName.textContent = player.name;
                if (player.isCaptain) {
                    playerName.className = 'player-captain';
                }
                playerInfo.appendChild(playerName);
                
                // Add captain badge if player is captain
                if (player.isCaptain) {
                    const captainBadge = document.createElement('span');
                    captainBadge.className = 'captain-badge';
                    captainBadge.textContent = 'Captain';
                    playerInfo.appendChild(captainBadge);
                }
                
                const playerTier = document.createElement('span');
                playerTier.textContent = `Tier ${player.tier}`;
                
                playerItem.appendChild(playerInfo);
                playerItem.appendChild(playerTier);
                
                playersList.appendChild(playerItem);
            });
            
            teamCard.appendChild(teamHeader);
            teamCard.appendChild(playersList);
            
            teamsDisplay.appendChild(teamCard);
        });
        
        // Update metrics display
        metricsDisplay.strengthVariance.textContent = distribution.strengthVariance.toFixed(2);
        metricsDisplay.strengthDiff.textContent = distribution.strengthDiff;
        metricsDisplay.tierImbalance.textContent = distribution.tierImbalance.toFixed(2);
        metricsDisplay.overallScore.textContent = distribution.score.toFixed(2);
    }

    /**
     * Reset the form to its initial state
     */
    function resetForm() {
        // Reset manual entry form
        playersContainer.innerHTML = '';
        addPlayerRow();
        
        // Reset CSV data
        csvData = null;
        csvPreview.innerHTML = '<p>CSV data will appear here</p>';
        csvFileInput.value = '';
        
        // Reset team configuration
        numTeamsInput.value = 2;
        document.getElementById('strategy-round-robin').checked = true;
        
        // Hide results
        resultsContainer.classList.remove('active');
        
        // Clear error messages
        setErrorMessage('');
        
        // Reset current results
        currentResults = null;
    }

    /**
     * Copy the results to clipboard
     */
    function copyResultsToClipboard() {
        if (!currentResults) return;
        
        try {
            let text = `Team Distributions (${currentResults.name}):\n\n`;
            
            currentResults.teams.forEach((team, index) => {
                text += `Team ${index + 1} (Total Strength: ${calculateTeamStrength(team)}):\n`;
                text += '-'.repeat(40) + '\n';
                
                // Sort players by tier ranking (from highest to lowest)
                const tierOrder = {
                    'S+': 0, 'S': 1, 'S/A': 2, 'A': 3, 'A/B': 4, 'B': 5, 'C': 6, 'D': 7, 'F': 8
                };
                
                const sortedTeam = [...team].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);
                
                sortedTeam.forEach(player => {
                    const captainMark = player.isCaptain ? ' [Captain]' : '';
                    text += `${player.name}${captainMark} (Tier ${player.tier})\n`;
                });
                
                text += '\n';
            });
            
            text += 'Evaluation Metrics:\n';
            text += '-'.repeat(40) + '\n';
            text += `Strength variance: ${currentResults.strengthVariance.toFixed(2)}\n`;
            text += `Max strength difference: ${currentResults.strengthDiff}\n`;
            text += `Tier imbalance score: ${currentResults.tierImbalance.toFixed(2)}\n`;
            text += `Overall balance score: ${currentResults.score.toFixed(2)} (lower is better)\n`;
            
            // Copy to clipboard
            navigator.clipboard.writeText(text)
                .then(() => {
                    showToast('Results copied to clipboard');
                })
                .catch(err => {
                    console.error('Failed to copy: ', err);
                    showToast('Failed to copy results', true);
                });
        } catch (error) {
            console.error('Copy error:', error);
            showToast('Failed to copy results', true);
        }
    }

    /**
     * Calculate the total strength of a team
     * @param {Array<Player>} team - Team array
     * @returns {number} Total strength
     */
    function calculateTeamStrength(team) {
        return team.reduce((sum, player) => sum + player.score, 0);
    }

    /**
     * Download the results as a CSV file
     */
    function downloadResults() {
        if (!currentResults) return;
        
        try {
            const csvContent = TeamBalancer.generateResultsCSV(currentResults.teams);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'team_results.csv');
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('Results downloaded as CSV');
        } catch (error) {
            console.error('Download error:', error);
            showToast('Failed to download results', true);
        }
    }

    /**
     * Download a CSV template
     */
    function downloadTemplate(e) {
        e.preventDefault();
        
        try {
            const templateContent = TeamBalancer.createCSVTemplate();
            const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.setAttribute('href', url);
            link.setAttribute('download', 'players_template.csv');
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('Template downloaded');
        } catch (error) {
            console.error('Template download error:', error);
            showToast('Failed to download template', true);
        }
    }

    /**
     * Set error message
     * @param {string} message - Error message
     */
    function setErrorMessage(message) {
        inputErrorDisplay.textContent = message;
        inputErrorDisplay.style.display = message ? 'block' : 'none';
    }

    /**
     * Show a toast notification
     * @param {string} message - Toast message
     * @param {boolean} isError - Whether this is an error toast
     */
    function showToast(message, isError = false) {
        // Create toast element if it doesn't exist
        let toast = document.getElementById('toast');
        
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '4px';
            toast.style.color = 'white';
            toast.style.zIndex = '1000';
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            document.body.appendChild(toast);
        }
        
        // Set toast style based on type
        toast.style.backgroundColor = isError ? '#e74c3c' : '#2ecc71';
        
        // Set message and show toast
        toast.textContent = message;
        toast.style.opacity = '1';
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
        }, 3000);
    }
});

