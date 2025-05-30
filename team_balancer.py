#!/usr/bin/env python3

import csv
import sys
from typing import List, Dict, Tuple, NamedTuple
import argparse
import itertools
import random
import statistics
from pathlib import Path

def load_players(csv_path: str, custom_weights: Dict[str, int] = None) -> List[Tuple[str, str, int]]:
    """
    Load players from CSV file and convert tiers to numeric scores.

    Args:
        csv_path: Path to the CSV file
        custom_weights: Optional dictionary mapping tier names to custom score weights

    Returns:
        List of tuples containing (name, tier, score)
    """
    # Default tier scores if no custom weights are provided
    tier_scores = {
        'S+': 13, 'S': 10, 'S/A': 9, 'A': 8, 'A/B': 7, 'B': 5, 'C': 2,
        'D': 0, 'F': -1
    }

    # Use custom weights if provided
    if custom_weights:
        tier_scores = custom_weights

    players = []
    seen_names = set()  # Track player names to prevent duplicates

    try:
        with open(csv_path, 'r') as f:
            reader = csv.reader(f)
            # Skip the header row
            next(reader, None)
            for row in reader:
                # Skip empty rows
                if not row or not any(field.strip() for field in row):
                    continue
                if len(row) < 2:
                    print(f"Warning: Skipping invalid row: {row}", file=sys.stderr)
                    continue
                name = row[0].strip()
                tier = row[1].strip().upper()

                # Check for duplicate player names
                if name in seen_names:
                    print(f"Warning: Duplicate player name found: '{name}'. Skipping.", file=sys.stderr)
                    continue

                if tier not in tier_scores:
                    print(f"Warning: Invalid tier '{tier}' for player '{name}'. "
                          f"Valid tiers are: {', '.join(tier_scores.keys())}", file=sys.stderr)
                    continue

                players.append((name, tier, tier_scores[tier]))
                seen_names.add(name)  # Add to set of seen names
    except FileNotFoundError:
        raise FileNotFoundError(f"Could not find CSV file: {csv_path}")
    except Exception as e:
        raise Exception(f"Error reading CSV file: {str(e)}")

    return players

def validate_player_count(players: List[Tuple[str, str, int]], num_teams: int) -> int:
    """
    Validate that we have an appropriate number of players for the number of teams.

    Args:
        players: List of player tuples
        num_teams: Number of teams to create

    Returns:
        The number of players per team

    Raises:
        ValueError: If the player count is not appropriate for the number of teams
    """
    total_players = len(players)

    # Check that we have at least 2 teams
    if num_teams < 2:
        raise ValueError(f"Number of teams must be at least 2. Received: {num_teams}")

    # Check that we have at least 1 player per team
    if total_players < num_teams:
        raise ValueError(f"Not enough players ({total_players}) for {num_teams} teams. "
                         f"Need at least {num_teams} players.")

    # Check that players can be evenly distributed among teams
    if total_players % num_teams != 0:
        raise ValueError(f"Total number of players ({total_players}) must be evenly "
                         f"divisible by the number of teams ({num_teams}).")

    return total_players // num_teams
def distribute_teams_round_robin(players: List[Tuple[str, str, int]],
                               num_teams: int,
                               players_per_team: int) -> List[List[Tuple[str, str, int]]]:
    """
    Distribute players into teams using snake draft approach.

    Args:
        players: List of (name, tier, score) tuples
        num_teams: Number of teams to create
        players_per_team: Number of players per team

    Returns:
        List of teams, where each team is a list of player tuples
    """
    # Sort players by score in descending order
    sorted_players = sorted(players, key=lambda x: x[2], reverse=True)

    # Initialize teams
    teams = [[] for _ in range(num_teams)]

    # First round: distribute top players to each team
    for i in range(num_teams):
        teams[i].append(sorted_players[i])

    # Remaining rounds: snake draft
    remaining_players = sorted_players[num_teams:]
    round_num = 1

    while remaining_players and all(len(team) < players_per_team for team in teams):
        # Determine direction (forward or backward)
        team_order = range(num_teams) if round_num % 2 == 1 else range(num_teams - 1, -1, -1)

        for team_idx in team_order:
            if not remaining_players or len(teams[team_idx]) >= players_per_team:
                continue

            teams[team_idx].append(remaining_players.pop(0))

        round_num += 1

    # Final validation: ensure all teams have exactly players_per_team players
    for team in teams:
        if len(team) != players_per_team:
            raise ValueError(f"Failed to distribute players evenly. Team has {len(team)} players instead of {players_per_team}")

    return teams

def calculate_team_metrics(team: List[Tuple[str, str, int]]) -> Tuple[int, Dict[str, int]]:
    """
    Calculate team strength and tier distribution.

    Args:
        team: List of player tuples

    Returns:
        Tuple of (total_strength, tier_counts)
    """
    total_strength = sum(player[2] for player in team)
    tier_counts = {}
    for _, tier, _ in team:
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
    return total_strength, tier_counts

class TeamDistribution(NamedTuple):
    """Class to represent a team distribution strategy with its results"""
    name: str
    description: str
    teams: List[List[Tuple[str, str, int]]]
    strength_variance: float = 0
    strength_diff: int = 0
    tier_imbalance: float = 0
    score: float = 0

def evaluate_teams(teams: List[List[Tuple[str, str, int]]]) -> Dict:
    """
    Evaluate the quality of team distribution.
    Lower score is better.

    Args:
        teams: List of teams

    Returns:
        Dictionary with evaluation metrics
    """
    # Calculate team strengths and tier distributions
    team_metrics = [calculate_team_metrics(team) for team in teams]
    team_strengths = [metrics[0] for metrics in team_metrics]

    # Calculate strength imbalance
    strength_diff = max(team_strengths) - min(team_strengths)
    avg_strength = sum(team_strengths) / len(team_strengths)
    strength_variance = sum((s - avg_strength) ** 2 for s in team_strengths) / len(team_strengths)

    # Calculate tier distribution imbalance
    tier_imbalance = 0
    all_tiers = set('SABCDEFG')
    for tier in all_tiers:
        tier_counts = [metrics[1].get(tier, 0) for metrics in team_metrics]
        if any(tier_counts):  # Only consider tiers that are present
            tier_variance = sum((c - sum(tier_counts)/len(tier_counts)) ** 2 for c in tier_counts)
            tier_imbalance += tier_variance

    # Calculate combined score (weighted sum)
    score = strength_variance * 2 + tier_imbalance + strength_diff * 10

    return {
        'strength_variance': strength_variance,
        'strength_diff': strength_diff,
        'tier_imbalance': tier_imbalance,
        'score': score
    }

def optimize_teams(teams: List[List[Tuple[str, str, int]]]) -> List[List[Tuple[str, str, int]]]:
    """
    Optimize team balance using advanced swapping and scoring.

    Args:
        teams: Initial team distribution

    Returns:
        Optimized team distribution
    """
    best_teams = [team.copy() for team in teams]
    evaluation = evaluate_teams(teams)
    best_score = evaluation['score']

    # If we already have perfect balance, return immediately
    if best_score == 0:
        return best_teams

    max_iterations = 1000  # Increase iterations for better optimization
    no_improvement_limit = 100
    no_improvement_count = 0

    for iteration in range(max_iterations):
        if no_improvement_count >= no_improvement_limit:
            break

        # Try single player swaps
        for i, j in itertools.combinations(range(len(teams)), 2):
            for p1 in range(len(teams[i])):
                for p2 in range(len(teams[j])):
                    # Create a copy of teams for testing swap
                    test_teams = [team.copy() for team in best_teams]

                    # Swap players
                    test_teams[i][p1], test_teams[j][p2] = test_teams[j][p2], test_teams[i][p1]

                    # Evaluate new distribution
                    new_evaluation = evaluate_teams(test_teams)
                    new_score = new_evaluation['score']

                    if new_score < best_score:
                        best_teams = [team.copy() for team in test_teams]
                        best_score = new_score
                        no_improvement_count = 0

                        # If we achieved perfect balance, return immediately
                        if best_score == 0:
                            return best_teams
                    else:
                        no_improvement_count += 1

        # Try multi-player swaps occasionally
        if iteration % 10 == 0:
            for i, j in itertools.combinations(range(len(teams)), 2):
                # Try swapping two players from each team
                for p1, p2 in itertools.combinations(range(len(teams[i])), 2):
                    for p3, p4 in itertools.combinations(range(len(teams[j])), 2):
                        test_teams = [team.copy() for team in best_teams]

                        # Swap player pairs
                        test_teams[i][p1], test_teams[j][p3] = test_teams[j][p3], test_teams[i][p1]
                        test_teams[i][p2], test_teams[j][p4] = test_teams[j][p4], test_teams[i][p2]

                        new_evaluation = evaluate_teams(test_teams)
                        new_score = new_evaluation['score']

                        if new_score < best_score:
                            best_teams = [team.copy() for team in test_teams]
                            best_score = new_score
                            no_improvement_count = 0

                            if best_score == 0:
                                return best_teams
                        else:
                            no_improvement_count += 1

    return best_teams

def distribute_teams_random(players: List[Tuple[str, str, int]],
                           num_teams: int,
                           players_per_team: int) -> List[List[Tuple[str, str, int]]]:
    """
    Distribute players into teams randomly with tier constraints.

    This strategy ensures even tier distribution by randomly assigning players
    from each tier to teams, distributing them evenly.

    Args:
        players: List of (name, tier, score) tuples
        num_teams: Number of teams to create
        players_per_team: Number of players per team

    Returns:
        List of teams, where each team is a list of player tuples
    """
    # Group players by tier
    players_by_tier = {}
    for player in players:
        tier = player[1]
        if tier not in players_by_tier:
            players_by_tier[tier] = []
        players_by_tier[tier].append(player)

    # Initialize teams
    teams = [[] for _ in range(num_teams)]

    # Distribute players tier by tier
    for tier, tier_players in sorted(players_by_tier.items()):
        # Shuffle players within each tier
        random.shuffle(tier_players)

        # Assign players of this tier to teams evenly
        for i, player in enumerate(tier_players):
            team_idx = i % num_teams
            teams[team_idx].append(player)

    # Shuffle teams to avoid consistent tier patterns
    for team in teams:
        random.shuffle(team)

    # Validate team sizes
    for team in teams:
        if len(team) != players_per_team:
            # Rebalance if needed (should rarely happen with even distribution)
            all_players = [player for team in teams for player in team]
            return distribute_teams_round_robin(all_players, num_teams, players_per_team)

    return teams

def distribute_teams_snake(players: List[Tuple[str, str, int]],
                         num_teams: int,
                         players_per_team: int) -> List[List[Tuple[str, str, int]]]:
    """
    Distribute players into teams using a pure snake draft strategy.

    This strategy simply sorts players by score in descending order and
    assigns them to teams in a snake draft pattern without any optimization.

    Args:
        players: List of (name, tier, score) tuples
        num_teams: Number of teams to create
        players_per_team: Number of players per team

    Returns:
        List of teams, where each team is a list of player tuples
    """
    # Sort players by score in descending order
    sorted_players = sorted(players, key=lambda x: x[2], reverse=True)

    # Initialize teams
    teams = [[] for _ in range(num_teams)]

    # Distribute players in snake draft pattern
    for i, player in enumerate(sorted_players):
        round_num = i // num_teams
        if round_num % 2 == 0:  # Forward order (round 0, 2, 4...)
            team_idx = i % num_teams
        else:  # Reverse order (round 1, 3, 5...)
            team_idx = num_teams - 1 - (i % num_teams)
        teams[team_idx].append(player)

    # Validate team sizes
    for team in teams:
        if len(team) != players_per_team:
            raise ValueError(f"Failed to distribute players evenly. Team has {len(team)} players instead of {players_per_team}")

    return teams

def distribute_teams_cluster(players: List[Tuple[str, str, int]],
                            num_teams: int,
                            players_per_team: int) -> List[List[Tuple[str, str, int]]]:
    """
    Distribute players using cluster-based approach.

    This strategy groups similar-strength players together first, then
    distributes those groups among teams in a balanced manner.

    Args:
        players: List of (name, tier, score) tuples
        num_teams: Number of teams to create
        players_per_team: Number of players per team

    Returns:
        List of teams, where each team is a list of player tuples
    """
    # Sort players by score
    sorted_players = sorted(players, key=lambda x: x[2], reverse=True)

    # Group players into clusters of size num_teams
    clusters = [sorted_players[i:i+num_teams] for i in range(0, len(sorted_players), num_teams)]

    # Initialize teams
    teams = [[] for _ in range(num_teams)]

    # Distribute clusters in alternating patterns
    for i, cluster in enumerate(clusters):
        if i % 2 == 0:  # Forward order
            for j, player in enumerate(cluster):
                if j < len(teams):
                    teams[j].append(player)
        else:  # Reverse order
            for j, player in enumerate(cluster):
                if j < len(teams):
                    teams[len(teams) - 1 - j].append(player)

    # Validate team sizes
    for team in teams:
        if len(team) != players_per_team:
            # This shouldn't happen with perfect division, but just in case
            raise ValueError(f"Failed to distribute players evenly in cluster method. Team has {len(team)} players instead of {players_per_team}")

    return teams

def create_team_distribution(strategy_name: str, 
                          players: List[Tuple[str, str, int]],
                          num_teams: int,
                          players_per_team: int) -> TeamDistribution:
    """
    Create a team distribution using the specified strategy.

    Args:
        strategy_name: Name of the distribution strategy to use
        players: List of player tuples
        num_teams: Number of teams to create
        players_per_team: Number of players per team

    Returns:
        TeamDistribution object containing the distribution and its metrics
    """
    # Map of strategy names to their corresponding functions and descriptions
    strategies = {
        'round_robin': {
            'func': distribute_teams_round_robin,
            'name': 'Round-Robin Distribution',
            'description': 'Distributes players in a snake draft pattern, ensuring top players are spread across teams.'
        },
        'random': {
            'func': distribute_teams_random,
            'name': 'Tier-Based Random Distribution',
            'description': 'Distributes players randomly while maintaining tier balance across teams.'
        },
        'cluster': {
            'func': distribute_teams_cluster,
            'name': 'Cluster-Based Distribution',
            'description': 'Groups similar-strength players together, then distributes groups to maximize diversity within teams.'
        },
        'snake': {
            'func': distribute_teams_snake,
            'name': 'Pure Snake Draft',
            'description': 'Simple snake draft pattern where teams pick players in alternating order without optimization.'
        }
    }

    # Ensure strategy exists
    if strategy_name not in strategies:
        raise ValueError(f"Unknown distribution strategy: {strategy_name}")

    strategy = strategies[strategy_name]

    # Create initial distribution
    initial_teams = strategy['func'](players, num_teams, players_per_team)

    # Optimize the distribution
    optimized_teams = initial_teams if strategy_name == "snake" else optimize_teams(initial_teams)

    # Evaluate the distribution
    evaluation = evaluate_teams(optimized_teams)

    # Create and return the TeamDistribution object
    return TeamDistribution(
        name=strategy['name'],
        description=strategy['description'],
        teams=optimized_teams,
        strength_variance=evaluation['strength_variance'],
        strength_diff=evaluation['strength_diff'],
        tier_imbalance=evaluation['tier_imbalance'],
        score=evaluation['score']
    )

def print_teams(teams: List[List[Tuple[str, str, int]]]) -> None:
    """
    Print team distributions with players sorted by tier ranking.

    Args:
        teams: List of teams, where each team is a list of player tuples
    """
    # Define tier order for sorting (S is highest, G is lowest)
    tier_order = {'S+': 0, 'S': 1, 'S/A': 2, 'A': 3, 'A/B': 4, 'B': 5, 'C': 6, 'D': 7, 'F': 8}

    print("\nTeam Distributions:")
    print("=" * 50)

    for i, team in enumerate(teams, 1):
        total_strength = sum(player[2] for player in team)
        print(f"\nTeam {i} (Total Strength: {total_strength})")
        print("-" * 40)

        # Sort players by tier ranking (from highest to lowest)
        sorted_team = sorted(team, key=lambda x: tier_order[x[1]])

        for name, tier, _ in sorted_team:
            print(f"{name} (Tier {tier})")

def print_distribution_summary(distribution: TeamDistribution, distribution_number: int) -> None:
    """
    Print a summary of a team distribution including its metrics.

    Args:
        distribution: TeamDistribution object
        distribution_number: The option number for this distribution
    """
    print(f"\n\nOPTION {distribution_number}: {distribution.name}")
    print("=" * 70)
    print(f"Description: {distribution.description}")
    print(f"Strength variance: {distribution.strength_variance:.2f}")
    print(f"Max strength difference between teams: {distribution.strength_diff}")
    print(f"Tier imbalance score: {distribution.tier_imbalance:.2f}")
    print(f"Overall balance score: {distribution.score:.2f} (lower is better)")

    # Print the team compositions
    print_teams(distribution.teams)

def main():
    parser = argparse.ArgumentParser(description='Balance teams based on player tiers.')
    parser.add_argument('csv_file', help='Path to the CSV file containing player data')
    parser.add_argument('--num-teams', '-n', type=int, required=True, 
                        help='Number of teams to create')
    parser.add_argument('--strategies', '-s', type=str, default='round_robin,random,cluster,snake',
                        help='Comma-separated list of strategies to use (default: round_robin,random,cluster,snake)')
    parser.add_argument('--custom-weights', '-w', type=str,
                        help='Custom weights for tiers in format "S:13,S-:10,A+:9,..." (default uses built-in weights)')

    try:
        args = parser.parse_args()

        # Parse custom weights if provided
        custom_weights = None
        if args.custom_weights:
            try:
                custom_weights = {}
                for pair in args.custom_weights.split(','):
                    tier, weight = pair.split(':')
                    custom_weights[tier.strip()] = int(weight.strip())
            except ValueError:
                raise ValueError("Invalid format for custom weights. Use format like 'S:13,S-:10,A+:9,...'")

        # Load players from CSV with custom weights if provided
        players = load_players(args.csv_file, custom_weights)

        # Validate player count and determine players per team
        players_per_team = validate_player_count(players, args.num_teams)

        # Get and validate the requested strategies
        valid_strategies = ['round_robin', 'random', 'cluster', 'snake']
        requested_strategies = [s.strip() for s in args.strategies.split(',')]
        
        # Validate each strategy
        for strategy in requested_strategies:
            if strategy not in valid_strategies:
                raise ValueError(f"Invalid strategy: '{strategy}'. Valid strategies are: {', '.join(valid_strategies)}")

        # Create team distributions using the requested strategies
        distributions = []
        for strategy in requested_strategies:
            distribution = create_team_distribution(
                strategy, players, args.num_teams, players_per_team
            )
            distributions.append(distribution)

        # Sort distributions by score (lower is better)
        distributions.sort(key=lambda d: d.score)

        # Print each distribution with its summary
        for i, distribution in enumerate(distributions, 1):
            print_distribution_summary(distribution, i)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
