import { Environment, Reservation, Table } from '../types';

export interface AvailabilityResult {
  available: boolean;
  tableIds?: string[]; // Best combination
  combinations?: string[][]; // All valid combinations
}

function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function getConnectedCombinations(tables: Table[], maxTablesToJoin: number = 10, requiredCapacity?: number): Table[][] {
  const combinations: Table[][] = [];
  const n = tables.length;
  if (n === 0) return [];

  const tableMap = new Map(tables.map(t => [t.id, t]));
  
  // Create adjacency list for available tables only
  const adj = new Map<string, string[]>();
  for (const t of tables) {
    const neighbors = (t.joinableWith || []).filter(id => tableMap.has(id));
    adj.set(t.id, neighbors);
  }

  // To avoid duplicates
  const seen = new Set<string>();
  const queued = new Set<string>();

  // BFS to find all connected subgraphs
  for (const startTable of tables) {
    const queue: Table[][] = [[startTable]];
    queued.add(startTable.id);
    
    while (queue.length > 0) {
      const currentCombo = queue.shift()!;
      
      const comboKey = currentCombo.map(t => t.id).sort().join(',');
      if (seen.has(comboKey)) continue;
      seen.add(comboKey);
      
      if (currentCombo.length > 1) {
        combinations.push(currentCombo);
      }

      // If we already meet the required capacity, any further addition will just create a strictly larger, non-optimal combination.
      if (requiredCapacity !== undefined) {
        const currentCapacity = currentCombo.reduce((sum, t) => sum + t.capacity, 0);
        if (currentCapacity >= requiredCapacity) {
          continue;
        }
      }

      // Limit the number of joined tables to prevent exponential explosion hanging the browser
      if (currentCombo.length >= maxTablesToJoin) {
        continue;
      }

      // Find all neighbors of the current combination that are not already in it
      const currentIds = new Set(currentCombo.map(t => t.id));
      const comboNeighbors = new Set<string>();
      
      for (const t of currentCombo) {
        const neighbors = adj.get(t.id) || [];
        for (const n of neighbors) {
          if (!currentIds.has(n)) {
            comboNeighbors.add(n);
          }
        }
      }

      // For each neighbor, create a new combination
      for (const nId of comboNeighbors) {
        const neighborTable = tableMap.get(nId)!;
        const nextCombo = [...currentCombo, neighborTable];
        const nextKey = nextCombo.map(t => t.id).sort().join(',');
        
        if (!queued.has(nextKey) && !seen.has(nextKey)) {
          queued.add(nextKey);
          queue.push(nextCombo);
        }
      }
    }
  }

  return combinations;
}

export function checkAvailability(
  environment: Environment,
  reservations: Reservation[],
  requestedTime: string,
  requestedGuests: number,
  requestedDuration: number = 120 // Default 2 hours
): AvailabilityResult {
  
  const reqStart = timeToMinutes(requestedTime);
  const reqEnd = reqStart + requestedDuration;

  // 1. Find occupied tables
  const occupiedTableIds = new Set<string>();
  
  for (const res of reservations) {
    // Only consider confirmed or pending reservations (if you want to block pending too)
    // Assuming 'reservations' passed here are the ones that should block availability
    if (res.status === 'cancelada') continue;
    if (res.environmentId !== environment.id) continue;

    const resStart = timeToMinutes(res.time);
    const resDuration = res.duration || 120;
    const resEnd = resStart + resDuration;

    // Check overlap
    if (reqStart < resEnd && reqEnd > resStart) {
      if (res.tableId) occupiedTableIds.add(res.tableId);
      if (res.tableIds) {
        res.tableIds.forEach(id => occupiedTableIds.add(id));
      }
    }
  }

  // 2. Filter available tables
  const availableTables = environment.tables.filter(t => !occupiedTableIds.has(t.id));

  // 3. Find all valid combinations (single tables + connected combinations)
  const allCombinations = [
    ...availableTables.map(t => [t]),
    ...getConnectedCombinations(availableTables, 10, requestedGuests)
  ];
  
  const fittingCombinations = allCombinations.filter(combo => {
    const totalCapacity = combo.reduce((sum, t) => sum + t.capacity, 0);
    return totalCapacity >= requestedGuests;
  });

  if (fittingCombinations.length > 0) {
    // Sort by total capacity ascending, then by number of tables ascending
    fittingCombinations.sort((a, b) => {
      const capA = a.reduce((sum, t) => sum + t.capacity, 0);
      const capB = b.reduce((sum, t) => sum + t.capacity, 0);
      if (capA !== capB) return capA - capB;
      return a.length - b.length;
    });

    // Only show combinations with the minimum possible capacity that fits the request
    const minCapacity = fittingCombinations[0].reduce((sum, t) => sum + t.capacity, 0);
    const bestFittingCombinations = fittingCombinations.filter(combo => {
      const cap = combo.reduce((sum, t) => sum + t.capacity, 0);
      return cap === minCapacity;
    });

    return {
      available: true,
      tableIds: bestFittingCombinations[0].map(t => t.id),
      combinations: bestFittingCombinations.map(combo => combo.map(t => t.id))
    };
  }

  // 5. No availability
  return {
    available: false
  };
}
