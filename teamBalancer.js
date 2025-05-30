/**
 * Team Balancer JavaScript Module
 * 
 * A JavaScript implementation of the team_balancer.py script
 * for generating balanced teams based on player skill tiers.
 */

// Default tier scores
const DEFAULT_TIER_SCORES = {
    'S+': 13,
    'S': 10,
    'S/A': 9,
    'A': 8,
    'A/B': 7,
    'B': 5,
    'C': 2,
    'D': 0,
    'F': -1
};

const DEFAULT_TIER_ORDER = ['S+', 'S', 'S/A', 'A', 'A/B', 'B', 'C', 'D', 'F'];

// Valid tiers set for validation
const VALID_TIERS = new Set(Object.keys(DEFAULT_TIER_SCORES));

/**
 * Player class to represent a player with name, tier, score, and captain status
 */
class Player {
    constructor(name, tier, isCaptain = false) {
        this.name = name;
        this.tier = tier;
        this.score = DEFAULT_TIER_SCORES[tier];
        this.isCaptain = isCaptain;
    }

    // Create a clone of this player
    clone() {
        return new Player(this.name, this.tier, this.isCaptain);
    }
}

/**
 * Team Distribution class to represent a team distribution strategy with its results
 */
class TeamDistribution {
    constructor(name, description, teams, strengthVariance = 0, strengthDiff = 0, tierImbalance = 0, score = 0) {
        this.name = name;
        this.description = description;
        this.teams = teams;
        this.strengthVariance = strengthVariance;
        this.strengthDiff = strengthDiff;
        this.tierImbalance = tierImbalance;
        this.score = score;
    }
}

/**
 * Load players from CSV content
 * @param {string} csvContent - CSV content as a string
 * @param {Object} customWeights - Optional custom tier score weights
 * @returns {Array<Player>} Array of Player objects
 */
function loadPlayersFromCSV(csvContent, customWeights = null) {
    // Use custom weights if provided, otherwise use defaults
    const tierScores = customWeights || DEFAULT_TIER_SCORES;
    
    // Parse CSV content
    const lines = csvContent.split(/\r?\n/);
    const players = [];
    const seenNames = new Set();
    
    // Check if the CSV has a Captain column
    const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
    const captainColumnIndex = headers.indexOf('captain');
    
    // Skip header row (first line)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines
        if (!line) continue;
        
        const columns = line.split(',').map(col => col.trim());
        
        // Skip invalid rows
        if (columns.length < 2) {
            console.warn(`Warning: Skipping invalid row: ${line}`);
            continue;
        }
        
        const name = columns[0];
        const tier = columns[1].toUpperCase();
        
        // Check if this player is a captain
        let isCaptain = false;
        if (captainColumnIndex !== -1 && columns.length > captainColumnIndex) {
            const captainValue = columns[captainColumnIndex].toLowerCase();
            isCaptain = captainValue === 'yes' || captainValue === 'true' || captainValue === '1';
        }
        
        // Check for duplicate player names
        if (seenNames.has(name)) {
            console.warn(`Warning: Duplicate player name found: '${name}'. Skipping.`);
            continue;
        }
        
        // Validate tier
        if (!(tier in tierScores)) {
            console.warn(`Warning: Invalid tier '${tier}' for player '${name}'. Valid tiers are: ${Object.keys(tierScores).join(', ')}`);
            continue;
        }
        
        players.push(new Player(name, tier, isCaptain));
        seenNames.add(name);
    }
    
    return players;
}

/**
 * Create CSV content from a template (for download)
 * @returns {string} CSV template content
 */
function createCSVTemplate() {
    return 'Name,Tier\nPlayer 1,S\nPlayer 2,A\nPlayer 3,B';
}

/**
 * Generate CSV content from results
 * @param {Array<Array<Player>>} teams - Teams array
 * @returns {string} CSV content of the results
 */
function generateResultsCSV(teams) {
    let csvContent = 'Team,Player,Tier,Captain\n';
    
    teams.forEach((team, teamIndex) => {
        team.forEach(player => {
            csvContent += `Team ${teamIndex + 1},${player.name},${player.tier},${player.isCaptain ? 'Yes' : 'No'}\n`;
        });
    });
    
    return csvContent;
}

/**
 * Validate that the number of players is appropriate for the number of teams
 * @param {Array<Player>} players - Array of Player objects
 * @param {number} numTeams - Number of teams to create
 * @returns {number} Number of players per team
 * @throws {Error} If validation fails
 */
function validatePlayerCount(players, numTeams) {
    const totalPlayers = players.length;
    
    // Check that we have at least 2 teams
    if (numTeams < 2) {
        throw new Error(`Number of teams must be at least 2. Received: ${numTeams}`);
    }
    
    // Check that we have at least 1 player per team
    if (totalPlayers < numTeams) {
        throw new Error(`Not enough players (${totalPlayers}) for ${numTeams} teams. Need at least ${numTeams} players.`);
    }
    
    // Check that players can be evenly distributed among teams
    if (totalPlayers % numTeams !== 0) {
        throw new Error(`Total number of players (${totalPlayers}) must be evenly divisible by the number of teams (${numTeams}).`);
    }
    
    // Check that the number of captains doesn't exceed the number of teams
    const captainCount = players.filter(player => player.isCaptain).length;
    if (captainCount > numTeams) {
        throw new Error(`Number of captains (${captainCount}) exceeds the number of teams (${numTeams}). Each team can have at most one captain.`);
    }
    
    return Math.floor(totalPlayers / numTeams);
}

/**
 * Calculate team metrics (strength and tier distribution)
 * @param {Array<Player>} team - Team array of Player objects
 * @returns {Object} Object containing total strength and tier counts
 */
function calculateTeamMetrics(team) {
    const totalStrength = team.reduce((sum, player) => sum + player.score, 0);
    const tierCounts = {};
    
    team.forEach(player => {
        tierCounts[player.tier] = (tierCounts[player.tier] || 0) + 1;
    });
    
    return { totalStrength, tierCounts };
}

/**
 * Evaluate teams based on strength and tier distribution
 * @param {Array<Array<Player>>} teams - Teams array
 * @returns {Object} Evaluation metrics
 */
function evaluateTeams(teams) {
    // Calculate team strengths and tier distributions
    const teamMetrics = teams.map(team => calculateTeamMetrics(team));
    const teamStrengths = teamMetrics.map(metrics => metrics.totalStrength);
    
    // Calculate strength imbalance
    const strengthDiff = Math.max(...teamStrengths) - Math.min(...teamStrengths);
    const avgStrength = teamStrengths.reduce((sum, strength) => sum + strength, 0) / teamStrengths.length;
    const strengthVariance = teamStrengths.reduce((sum, strength) => sum + Math.pow(strength - avgStrength, 2), 0) / teamStrengths.length;
    
    // Calculate tier distribution imbalance
    let tierImbalance = 0;
    const allTiers = new Set('S+SABCDEF'.split(''));
    
    allTiers.forEach(tier => {
        const tierCounts = teamMetrics.map(metrics => metrics.tierCounts[tier] || 0);
        
        if (tierCounts.some(count => count > 0)) {  // Only consider tiers that are present
            const tierAvg = tierCounts.reduce((sum, count) => sum + count, 0) / tierCounts.length;
            const tierVariance = tierCounts.reduce((sum, count) => sum + Math.pow(count - tierAvg, 2), 0);
            tierImbalance += tierVariance;
        }
    });
    
    // Calculate combined score (weighted sum)
    const score = strengthVariance * 2 + tierImbalance + strengthDiff * 10;
    
    return {
        strengthVariance,
        strengthDiff,
        tierImbalance,
        score
    };
}

/**
 * Distribute teams using round-robin strategy
 * @param {Array<Player>} players - Array of Player objects
 * @param {number} numTeams - Number of teams to create
 * @param {number} playersPerTeam - Number of players per team
 * @returns {Array<Array<Player>>} Teams array
 */
function distributeTeamsRoundRobin(players, numTeams, playersPerTeam) {
    // Separate captains from regular players
    const captains = players.filter(player => player.isCaptain);
    const nonCaptains = players.filter(player => !player.isCaptain);
    
    // Initialize teams
    const teams = Array(numTeams).fill().map(() => []);
    
    // First, distribute captains to teams
    captains.forEach((captain, index) => {
        teams[index].push(captain);
    });
    
    // Sort remaining players by score in descending order
    const sortedPlayers = [...nonCaptains].sort((a, b) => b.score - a.score);
    
    // If we have fewer captains than teams, distribute top players to remaining teams
    const teamsWithoutCaptains = teams.filter(team => team.length === 0);
    const topPlayers = sortedPlayers.splice(0, teamsWithoutCaptains.length);
    
    teamsWithoutCaptains.forEach((team, index) => {
        team.push(topPlayers[index]);
    });
    
    // Remaining rounds: snake draft
    let roundNum = 1;
    
    while (sortedPlayers.length > 0 && teams.every(team => team.length < playersPerTeam)) {
        // Determine direction (forward or backward)
        const teamOrder = roundNum % 2 === 1 
            ? Array.from({ length: numTeams }, (_, i) => i)
            : Array.from({ length: numTeams }, (_, i) => numTeams - 1 - i);
        
        for (const teamIdx of teamOrder) {
            if (sortedPlayers.length === 0 || teams[teamIdx].length >= playersPerTeam) {
                continue;
            }
            
            teams[teamIdx].push(sortedPlayers.shift());
        }
        
        roundNum++;
    }
    
    // Final validation: ensure all teams have exactly playersPerTeam players
    for (const team of teams) {
        if (team.length !== playersPerTeam) {
            throw new Error(`Failed to distribute players evenly. Team has ${team.length} players instead of ${playersPerTeam}`);
        }
    }
    
    return teams;
}

/**
 * Distribute teams using random strategy with tier constraints
 * @param {Array<Player>} players - Array of Player objects
 * @param {number} numTeams - Number of teams to create
 * @param {number} playersPerTeam - Number of players per team
 * @returns {Array<Array<Player>>} Teams array
 */
function distributeTeamsRandom(players, numTeams, playersPerTeam) {
    // Separate captains from regular players
    const captains = players.filter(player => player.isCaptain);
    const nonCaptains = players.filter(player => !player.isCaptain);
    
    // Initialize teams
    const teams = Array(numTeams).fill().map(() => []);
    
    // First, distribute captains to teams
    captains.forEach((captain, index) => {
        teams[index].push(captain);
    });
    
    // Group remaining players by tier
    const playersByTier = {};
    nonCaptains.forEach(player => {
        if (!playersByTier[player.tier]) {
            playersByTier[player.tier] = [];
        }
        playersByTier[player.tier].push(player);
    });
    
    // Distribute players tier by tier
    Object.entries(playersByTier).sort().forEach(([tier, tierPlayers]) => {
        // Shuffle players within each tier
        shuffle(tierPlayers);
        
        // Assign players of this tier to teams evenly
        tierPlayers.forEach((player, i) => {
            const teamIdx = i % numTeams;
            teams[teamIdx].push(player);
        });
    });
    
    // Shuffle teams to avoid consistent tier patterns (but keep the first player as captain)
    teams.forEach(team => {
        const firstPlayer = team[0];
        const restPlayers = team.slice(1);
        shuffle(restPlayers);
        team.length = 0; // Clear the array
        team.push(firstPlayer, ...restPlayers);
    });
    
    // Validate team sizes
    for (const team of teams) {
        if (team.length !== playersPerTeam) {
            // Rebalance if needed (should rarely happen with even distribution)
            const allPlayers = teams.flat();
            return distributeTeamsRoundRobin(allPlayers, numTeams, playersPerTeam);
        }
    }
    
    return teams;
}

/**
 * Distribute teams using snake draft strategy
 * @param {Array<Player>} players - Array of Player objects
 * @param {number} numTeams - Number of teams to create
 * @param {number} playersPerTeam - Number of players per team
 * @returns {Array<Array<Player>>} Teams array
 */
function distributeTeamsSnake(players, numTeams, playersPerTeam) {
    // Separate captains from regular players
    const captains = players.filter(player => player.isCaptain);
    const nonCaptains = players.filter(player => !player.isCaptain);
    
    // Initialize teams
    const teams = Array(numTeams).fill().map(() => []);
    
    // First, distribute captains to teams
    captains.forEach((captain, index) => {
        teams[index].push(captain);
    });
    
    // Sort non-captain players by score in descending order
    const sortedPlayersA = [...nonCaptains].sort((a, b) => b.score - a.score);
    const sortedPlayers = [];
    // Sort remaining players by tier
    const playersByTier = {};
    nonCaptains.forEach(player => {
        if (!playersByTier[player.tier]) {
            playersByTier[player.tier] = [];
        }
        playersByTier[player.tier].push(player);
    });
    DEFAULT_TIER_ORDER.forEach(tier => {
        if (tier in playersByTier) {
            const playersInTier = [...playersByTier[tier]];
            playersInTier.sort( () => Math.random()-0.5 );
            sortedPlayers.push(...playersInTier);
        }
    });
    debugger;
    
    // Determine the starting position for the snake draft
    // Skip teams that already have a captain
    let currentIndex = 0;
    let initialTeamsFilled = false;
    
    // First, fill teams without captains
    while (!initialTeamsFilled && sortedPlayers.length > 0) {
        if (teams[currentIndex].length === 0) {
            teams[currentIndex].push(sortedPlayers.shift());
        }
        
        currentIndex++;
        if (currentIndex >= numTeams) {
            initialTeamsFilled = true;
        }
    }
    
    // Now, continue with snake draft for remaining players
    let roundNum = 1; // Start from round 1 since round 0 was for captains and filling empty teams
    
    while (sortedPlayers.length > 0) {
        // Determine draft order (forward or backward)
        const teamIndices = roundNum % 2 === 0
            ? Array.from({ length: numTeams }, (_, i) => i)
            : Array.from({ length: numTeams }, (_, i) => numTeams - 1 - i);
        
        for (const teamIdx of teamIndices) {
            if (sortedPlayers.length === 0 || teams[teamIdx].length >= playersPerTeam) {
                continue;
            }
            
            teams[teamIdx].push(sortedPlayers.shift());
        }
        
        roundNum++;
    }
    
    // Validate team sizes
    for (const team of teams) {
        if (team.length !== playersPerTeam) {
            throw new Error(`Failed to distribute players evenly. Team has ${team.length} players instead of ${playersPerTeam}`);
        }
    }
    
    return teams;
}

/**
 * Distribute teams using cluster-based approach
 * @param {Array<Player>} players - Array of Player objects
 * @param {number} numTeams - Number of teams to create
 * @param {number} playersPerTeam - Number of players per team
 * @returns {Array<Array<Player>>} Teams array
 */
function distributeTeamsCluster(players, numTeams, playersPerTeam) {
    // Separate captains from regular players
    const captains = players.filter(player => player.isCaptain);
    const nonCaptains = players.filter(player => !player.isCaptain);
    
    // Initialize teams
    const teams = Array(numTeams).fill().map(() => []);
    
    // First, distribute captains to teams
    captains.forEach((captain, index) => {
        teams[index].push(captain);
    });
    
    // Sort non-captain players by score
    const sortedPlayers = [...nonCaptains].sort((a, b) => b.score - a.score);
    
    // Fill any teams that don't have captains with the top non-captain players
    let captainlessTeamsFilled = false;
    let currentIndex = 0;
    
    while (!captainlessTeamsFilled && sortedPlayers.length > 0) {
        if (teams[currentIndex].length === 0) {
            teams[currentIndex].push(sortedPlayers.shift());
        }
        
        currentIndex++;
        if (currentIndex >= numTeams) {
            captainlessTeamsFilled = true;
        }
    }
    
    // Group remaining players into clusters of size numTeams
    const clusters = [];
    for (let i = 0; i < sortedPlayers.length; i += numTeams) {
        clusters.push(sortedPlayers.slice(i, i + numTeams));
    }
    
    // Distribute clusters in alternating patterns
    clusters.forEach((cluster, i) => {
        if (i % 2 === 0) { // Forward order
            cluster.forEach((player, j) => {
                if (j < teams.length) {
                    teams[j].push(player);
                }
            });
        } else { // Reverse order
            cluster.forEach((player, j) => {
                if (j < teams.length) {
                    teams[teams.length - 1 - j].push(player);
                }
            });
        }
    });
    
    // Validate team sizes
    for (const team of teams) {
        if (team.length !== playersPerTeam) {
            throw new Error(`Failed to distribute players evenly in cluster method. Team has ${team.length} players instead of ${playersPerTeam}`);
        }
    }
    
    return teams;
}

/**
 * Optimize teams by swapping players to achieve better balance
 * @param {Array<Array<Player>>} teams - Teams array
 * @returns {Array<Array<Player>>} Optimized teams array
 */
function optimizeTeams(teams) {
    // Deep clone the teams to avoid modifying the original
    let bestTeams = teams.map(team => team.map(player => player.clone()));
    let evaluation = evaluateTeams(bestTeams);
    let bestScore = evaluation.score;
    
    // If we already have perfect balance, return immediately
    if (bestScore === 0) {
        return bestTeams;
    }
    
    const maxIterations = 1000; // Increase iterations for better optimization
    const noImprovementLimit = 100;
    let noImprovementCount = 0;
    
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        if (noImprovementCount >= noImprovementLimit) {
            break;
        }
        
        // Try single player swaps
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                for (let p1 = 0; p1 < teams[i].length; p1++) {
                    for (let p2 = 0; p2 < teams[j].length; p2++) {
                        // Create a copy of teams for testing swap
                        const testTeams = bestTeams.map(team => team.map(player => player.clone()));
                        
                        // Swap players
                        [testTeams[i][p1], testTeams[j][p2]] = [testTeams[j][p2], testTeams[i][p1]];
                        
                        // Evaluate new distribution
                        const newEvaluation = evaluateTeams(testTeams);
                        const newScore = newEvaluation.score;
                        
                        if (newScore < bestScore) {
                            bestTeams = testTeams;
                            bestScore = newScore;
                            noImprovementCount = 0;
                            
                            // If we achieved perfect balance, return immediately
                            if (bestScore === 0) {
                                return bestTeams;
                            }
                        } else {
                            noImprovementCount++;
                        }
                    }
                }
            }
        }
        
        // Try multi-player swaps occasionally
        if (iteration % 10 === 0) {
            for (let i = 0; i < teams.length; i++) {
                for (let j = i + 1; j < teams.length; j++) {
                    // Try swapping two players from each team
                    for (let p1 = 0; p1 < teams[i].length; p1++) {
                        for (let p2 = p1 + 1; p2 < teams[i].length; p2++) {
                            for (let p3 = 0; p3 < teams[j].length; p3++) {
                                for (let p4 = p3 + 1; p4 < teams[j].length; p4++) {
                                    const testTeams = bestTeams.map(team => team.map(player => player.clone()));
                                    
                                    // Swap player pairs
                                    [testTeams[i][p1], testTeams[j][p3]] = [testTeams[j][p3], testTeams[i][p1]];
                                    [testTeams[i][p2], testTeams[j][p4]] = [testTeams[j][p4], testTeams[i][p2]];
                                    
                                    const newEvaluation = evaluateTeams(testTeams);
                                    const newScore = newEvaluation.score;
                                    
                                    if (newScore < bestScore) {
                                        bestTeams = testTeams;
                                        bestScore = newScore;
                                        noImprovementCount = 0;
                                        
                                        if (bestScore === 0) {
                                            return bestTeams;
                                        }
                                    } else {
                                        noImprovementCount++;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    return bestTeams;
}

/**
 * Create a team distribution using the specified strategy
 * @param {string} strategyName - Name of the distribution strategy
 * @param {Array<Player>} players - Array of Player objects
 * @param {number} numTeams - Number of teams to create
 * @param {number} playersPerTeam - Number of players per team
 * @returns {TeamDistribution} TeamDistribution object
 */
function createTeamDistribution(strategyName, players, numTeams, playersPerTeam) {
    // Map of strategy names to their corresponding functions and descriptions
    const strategies = {
        'round_robin': {
            func: distributeTeamsRoundRobin,
            name: 'Round-Robin Distribution',
            description: 'Distributes players in a snake draft pattern, ensuring top players are spread across teams.'
        },
        'random': {
            func: distributeTeamsRandom,
            name: 'Tier-Based Random Distribution',
            description: 'Distributes players randomly while maintaining tier balance across teams.'
        },
        'cluster': {
            func: distributeTeamsCluster,
            name: 'Cluster-Based Distribution',
            description: 'Groups similar-strength players together, then distributes groups to maximize diversity within teams.'
        },
        'snake': {
            func: distributeTeamsSnake,
            name: 'Pure Snake Draft',
            description: 'Simple snake draft pattern where teams pick players in alternating order without optimization.'
        }
    };
    
    // Ensure strategy exists
    if (!strategies[strategyName]) {
        throw new Error(`Unknown distribution strategy: ${strategyName}`);
    }
    
    const strategy = strategies[strategyName];
    
    // Create initial distribution
    const initialTeams = strategy.func(players, numTeams, playersPerTeam);
    
    // Optimize the distribution
    const optimizedTeams = strategyName === "snake" ? initialTeams : optimizeTeams(initialTeams);
    
    // Evaluate the distribution
    const evaluation = evaluateTeams(optimizedTeams);
    
    // Create and return the TeamDistribution object
    return new TeamDistribution(
        strategy.name,
        strategy.description,
        optimizedTeams,
        evaluation.strengthVariance,
        evaluation.strengthDiff,
        evaluation.tierImbalance,
        evaluation.score
    );
}

/**
 * Shuffle an array in place (Fisher-Yates algorithm)
 * @param {Array} array - Array to shuffle
 */
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * Format teams for display
 * @param {Array<Array<Player>>} teams - Teams array
 * @returns {Object} Formatted teams object with strength info
 */
function formatTeamsForDisplay(teams) {
    return teams.map((team, index) => {
        const { totalStrength } = calculateTeamMetrics(team);
        
        // Sort players by tier ranking (from highest to lowest)
        const tierOrder = {
            'S+': 0, 'S': 1, 'S/A': 2, 'A': 3, 'A/B': 4, 'B': 5, 'C': 6, 'D': 7, 'F': 8
        };
        
        // Keep captains at the top, then sort by tier
        const sortedTeam = [...team].sort((a, b) => {
            if (a.isCaptain && !b.isCaptain) return -1;
            if (!a.isCaptain && b.isCaptain) return 1;
            return tierOrder[a.tier] - tierOrder[b.tier];
        });
        
        return {
            teamNumber: index + 1,
            totalStrength,
            players: sortedTeam.map(player => ({
                name: player.name,
                tier: player.tier,
                isCaptain: player.isCaptain
            }))
        };
    });
}

/**
 * Validate player name and tier
 * @param {string} name - Player name
 * @param {string} tier - Player tier
 * @param {boolean} captain - Whether the player is a captain
 * @returns {Object} Validation result with isValid and message
 */
function validatePlayer(name, tier, captain = false) {
    if (!name || name.trim() === '') {
        return { isValid: false, message: 'Player name cannot be empty' };
    }
    
    if (!tier || !VALID_TIERS.has(tier)) {
        return { isValid: false, message: `Invalid tier: ${tier}. Valid tiers are: ${Array.from(VALID_TIERS).join(', ')}` };
    }
    
    return { isValid: true, message: '' };
}

// Export the API
const TeamBalancer = {
    DEFAULT_TIER_SCORES,
    VALID_TIERS,
    Player,
    TeamDistribution,
    loadPlayersFromCSV,
    createCSVTemplate,
    generateResultsCSV,
    validatePlayerCount,
    evaluateTeams,
    createTeamDistribution,
    formatTeamsForDisplay,
    validatePlayer
};

// Make available globally
window.TeamBalancer = TeamBalancer;

