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
        
        // Create remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'danger';
        removeBtn.title = 'Remove player';
        removeBtn.textContent = '-';
        removeBtn.dataset.action = 'remove-player';
        
        // Append elements to row
        playerRow.appendChild(nameInput);
        playerRow.appendChild(tierSelect);
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
     * Display a preview of the CSV data
     * @param {string} content - CSV content as string
     */
    function displayCSVPreview(content) {
        try {
            const lines = content.split(/\r?\n/);
            if (lines.length === 0) {
                throw new Error('CSV file is empty');
            }
            
            // Create table for preview
            const table = document.createElement('table');
            
            // Create header row
            const headerRow = document.createElement('tr');
            const headerColumns = lines[0].split(',');
            
            headerColumns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = col.trim();
                headerRow.appendChild(th);
            });
            
            table.appendChild(headerRow);
            
            // Create data rows (limit to 10 for preview)
            const maxRows = Math.min(lines.length, 11);
            for (let i = 1; i < maxRows; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const row = document.createElement('tr');
                const columns = line.split(',');
                
                columns.forEach(col => {
                    const td = document.createElement('td');
                    td.textContent = col.trim();
                    row.appendChild(td);
                });
                
                table.appendChild(row);
            }
            
            // Show ellipsis if there are more rows
            if (lines.length > 11) {
                const ellipsisRow = document.createElement('tr');
                const td = document.createElement('td');
                td.colSpan = headerColumns.length;
                td.textContent = '...';
                td.style.textAlign = 'center';
                ellipsisRow.appendChild(td);
                table.appendChild(ellipsisRow);
            }
            
            // Update preview area
            csvPreview.innerHTML = '';
            csvPreview.appendChild(table);
            
            // Add row count info
            const rowInfo = document.createElement('p');
            rowInfo.textContent = `Total rows: ${lines.length - 1} (including empty rows)`;
            csvPreview.appendChild(rowInfo);
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
        
        for (const row of playerRows) {
            const nameInput = row.querySelector('input[type="text"]');
            const tierSelect = row.querySelector('select');
            
            const name = nameInput.value.trim();
            const tier = tierSelect.value;
            
            // Validate player
            const validation = TeamBalancer.validatePlayer(name, tier);
            if (!validation.isValid) {
                throw new Error(validation.message);
            }
            
            // Check for duplicate names
            if (seenNames.has(name)) {
                throw new Error(`Duplicate player name: ${name}`);
            }
            
            players.push(new TeamBalancer.Player(name, tier));
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
        
        const players = TeamBalancer.loadPlayersFromCSV(csvData);
        
        if (players.length === 0) {
            throw new Error('No valid players found in CSV');
        }
        
        return players;
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
                
                const playerName = document.createElement('span');
                playerName.textContent = player.name;
                
                const playerTier = document.createElement('span');
                playerTier.textContent = `Tier ${player.tier}`;
                
                playerItem.appendChild(playerName);
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
                    text += `${player.name} (Tier ${player.tier})\n`;
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

