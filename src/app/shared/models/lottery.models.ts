// Category constants matching the legacy NumbersCategory values.
export const NumbersCategory = {
  LUCKY: 'lucky',
  USER_GENERATED: 'user-generated',
  GROUP_CALCULATED: 'group-calculated',
} as const;

export type NumbersCategoryType = (typeof NumbersCategory)[keyof typeof NumbersCategory];

export interface GenerateFormRequest {
  howMany: number;
  formType?: number;
  willBe?: number[];
  from?: string;
  to?: string;
  strength?: 'strong' | 'weak';
}

export interface StatisticsRequest {
  howMany: number;
  formType?: number;
  from?: string;
  to?: string;
  strength?: 'strong' | 'weak';
}

export interface AnalyzeRequest {
  form: number[];
  from?: string;
  to?: string;
}

export interface PairResponse {
  numbers: number[];
  count: number;
}

export interface FrequencyEntryResponse {
  numbers: number[];
  count: number;
}

export interface FrequencyGroupResponse {
  size: number;
  combos: number;
  entries: FrequencyEntryResponse[];
}

export interface LotteryResultResponse {
  forms?: number[][];
  pairs?: PairResponse[];
  frequencyGroups?: FrequencyGroupResponse[];
}

export interface SaveNumbersRequest {
  category: string;
  numbers: number[];
  willBe?: number[];
  dateFrom?: string;
  dateTo?: string;
}

export interface SavedNumbersResponse {
  id: number;
  category: string;
  numbers: number[];
  willBe?: number[];
  dateFrom?: string;
  dateTo?: string;
  createdAt: string;
}

export interface UserProfileResponse {
  sub: string;
  email: string;
  displayName: string;
  roles: string[];
}

// ── Simulate (backtest) ─────────────────────────────────────────

export interface SimulateRequest {
  form: number[];
  strong: number;
  from?: string;
  to?: string;
  ticketCost?: number;
  prizeAmounts?: number[];
}

export interface SimulateTierHitResponse {
  tier: number;
  hits: number;
  amountPerHit: number;
  total: number;
}

export interface SimulateDrawResultResponse {
  drawNumber: number;
  drawDate: string;
  winningNumbers: number[];
  winningStrong: number;
  tierHits: SimulateTierHitResponse[];
  prizeWon: number;
  ticketCost: number;
  usedRealPrizes: boolean;
}

export interface SimulateTierSummaryResponse {
  tier: number;
  label: string;
  totalHits: number;
  totalAmount: number;
}

export interface SimulateSummaryResponse {
  totalDraws: number;
  totalCombinations: number;
  totalSpent: number;
  totalWon: number;
  net: number;
  tierSummaries: SimulateTierSummaryResponse[];
  drawsWithRealPrizes: number;
}

export interface SimulateResultResponse {
  draws: SimulateDrawResultResponse[];
  summary: SimulateSummaryResponse;
}

// Default prize amounts per tier (ILS) — Israeli Lotto.
// Tier 1 (6+strong) through Tier 8 (3 matches).
export const DEFAULT_PRIZE_AMOUNTS: number[] = [
  5_000_000, // tier 1: 6 + strong (jackpot minimum)
  750_000,   // tier 2: 6 (second prize minimum)
  10_000,    // tier 3: 5 + strong
  2_000,     // tier 4: 5
  500,       // tier 5: 4 + strong
  150,       // tier 6: 4
  75,        // tier 7: 3 + strong
  15,        // tier 8: 3
];

export const TIER_LABELS: string[] = [
  '6+strong', '6', '5+strong', '5', '4+strong', '4', '3+strong', '3',
];

export const DEFAULT_TICKET_COST = 3.0;
