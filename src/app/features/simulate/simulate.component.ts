import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api/api.service';
import { LanguageService } from '../../core/i18n/language.service';
import { ArchiveWindowService } from '../../shared/services/archive-window.service';
import { ToastService } from '../../shared/components/toast/toast.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ArchiveWindowComponent } from '../../shared/components/archive-window/archive-window.component';
import { LotteryBallComponent } from '../../shared/components/lottery-ball/lottery-ball.component';
import { NumberSetComponent } from '../../shared/components/number-set/number-set.component';
import { subscribeWithError } from '../../shared/utils/http-loading';
import {
  DEFAULT_PRIZE_AMOUNTS,
  DEFAULT_TICKET_COST,
  SavedNumbersResponse,
  SimulateRequest,
  SimulateResultResponse,
  SimulateDrawResultResponse,
  TIER_LABELS,
} from '../../shared/models/lottery.models';

@Component({
  selector: 'app-simulate',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    ArchiveWindowComponent,
    LotteryBallComponent,
    NumberSetComponent,
    DatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h2>{{ 'simulate.title' | translate }}</h2>
      <p>{{ 'simulate.subtitle' | translate }}</p>

      <div class="saved-loader">
        <span class="saved-title">{{ 'simulate.loadSaved' | translate }}</span>
        @if (savedLoading()) {
          <span class="saved-hint">{{ 'saved.loading' | translate }}</span>
        }
        @if (savedSets().length === 0 && !savedLoading()) {
          <span class="saved-hint">{{ 'simulate.noSaved' | translate }}</span>
        }
        @if (savedSets().length > 0) {
          <div class="saved-list">
            @for (s of savedSets(); track s.id) {
              <button
                type="button"
                class="saved-item"
                [class.selected]="selectedSavedId() === s.id"
                (click)="loadSavedSet(s.id)"
              >
                <app-number-set
                  [numbers]="s.numbers"
                  [strong]="s.willBe ?? []"
                  size="sm"
                />
              </button>
            }
          </div>
        }
      </div>

      <app-archive-window />

      <div class="form-grid">
        <div class="form-row">
          <label for="formSize">{{ 'simulate.formSize' | translate }}</label>
          <select id="formSize" [(ngModel)]="formSize" (ngModelChange)="onFormSizeChange()">
            @for (s of formSizes; track s) {
              <option [ngValue]="s">{{ s }}</option>
            }
          </select>
        </div>
        <div class="form-row">
          <label for="ticketCost">{{ 'simulate.ticketCost' | translate }}</label>
          <input id="ticketCost" type="number" min="0" step="0.5" [(ngModel)]="ticketCost" />
        </div>
      </div>

      <div class="selected-section">
        <span class="label">{{ 'simulate.selectedNumbers' | translate }} ({{ selected().length }}/{{ formSize }})</span>
        <div class="selected-balls">
          @for (num of selected(); track num; let i = $index) {
            <app-lottery-ball
              [number]="num"
              variant="regular"
              size="md"
              (click)="removeNumber(i)"
            />
          }
        </div>
        @if (selected().length > 0) {
          <button class="secondary clear-btn" (click)="clearNumbers()">
            {{ 'simulate.clear' | translate }}
          </button>
        }
      </div>

      <div class="pick-grid">
        @for (num of choices(); track num) {
          <app-lottery-ball
            [number]="num"
            variant="muted"
            size="md"
            (click)="addNumber(num)"
          />
        }
      </div>

      <div class="strong-section">
        <span class="label">{{ 'simulate.strongNumber' | translate }} (1-7)</span>
        <div class="strong-balls">
          @for (s of strongNumbers; track s) {
            <button
              type="button"
              class="strong-ball"
              [class.selected]="strong() === s"
              (click)="strong.set(s)"
            >{{ s }}</button>
          }
        </div>
      </div>

      <div class="prize-config">
        <div class="prize-header" (click)="showPrizeConfig.set(!showPrizeConfig())">
          <span class="expand-icon">{{ showPrizeConfig() ? '▾' : '▸' }}</span>
          <span>{{ 'simulate.prizeConfig' | translate }}</span>
        </div>
        @if (showPrizeConfig()) {
          <div class="prize-grid">
            @for (label of tierLabels; track label; let i = $index) {
              <div class="prize-row">
                <label>{{ label }}</label>
                <input type="number" min="0" step="100" [(ngModel)]="prizeAmounts[i]" />
              </div>
            }
          </div>
        }
      </div>

      <button
        class="primary"
        (click)="simulate()"
        [disabled]="selected().length !== formSize || strong() === 0 || !dateRangeValid()"
      >
        {{ 'simulate.button' | translate }}
      </button>

      @if (result()) {
        <div class="results">
          <h3>{{ 'simulate.results' | translate }}</h3>

          <div class="summary-grid">
            <div class="summary-card">
              <span class="summary-label">{{ 'simulate.totalDraws' | translate }}</span>
              <span class="summary-value">{{ summary().totalDraws }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ 'simulate.totalSpent' | translate }}</span>
              <span class="summary-value spent">{{ formatCurrency(summary().totalSpent) }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ 'simulate.totalWon' | translate }}</span>
              <span class="summary-value won">{{ formatCurrency(summary().totalWon) }}</span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ 'simulate.net' | translate }}</span>
              <span class="summary-value" [class.profit]="summary().net >= 0" [class.loss]="summary().net < 0">
                {{ formatCurrency(summary().net) }}
              </span>
            </div>
            <div class="summary-card">
              <span class="summary-label">{{ 'simulate.realPrizes' | translate }}</span>
              <span class="summary-value" [class.real]="summary().drawsWithRealPrizes > 0">
                {{ summary().drawsWithRealPrizes }} / {{ summary().totalDraws }}
              </span>
            </div>
          </div>

          <div class="tier-summary">
            <h4>{{ 'simulate.tierSummary' | translate }}</h4>
            <table>
              <thead>
                <tr>
                  <th>{{ 'simulate.tier' | translate }}</th>
                  <th>{{ 'simulate.hits' | translate }}</th>
                  <th>{{ 'simulate.amount' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (ts of summary().tierSummaries; track ts.tier) {
                  <tr [class.has-hits]="ts.totalHits > 0">
                    <td>{{ ts.label }}</td>
                    <td>{{ ts.totalHits }}</td>
                    <td>{{ formatCurrency(ts.totalAmount) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="draws-section">
            <h4>{{ 'simulate.drawHistory' | translate }}</h4>
            @if (winningDraws().length > 0) {
              <table class="draws-table">
                <thead>
                  <tr>
                    <th>{{ 'simulate.drawDate' | translate }}</th>
                    <th>{{ 'simulate.winningNumbers' | translate }}</th>
                    <th>{{ 'simulate.strongShort' | translate }}</th>
                    <th>{{ 'simulate.tierHit' | translate }}</th>
                    <th>{{ 'simulate.prize' | translate }}</th>
                    <th>{{ 'simulate.cost' | translate }}</th>
                    <th>{{ 'simulate.prizeSource' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of winningDraws(); track d.drawNumber) {
                    <tr>
                      <td>{{ d.drawDate | date: 'yyyy-MM-dd' }}</td>
                      <td class="winning-balls">
                        @for (n of d.winningNumbers; track n) {
                          <span class="mini-ball">{{ n }}</span>
                        }
                      </td>
                      <td><span class="mini-ball strong">{{ d.winningStrong }}</span></td>
                      <td>
                        @for (hit of d.tierHits; track hit.tier) {
                          <span class="tier-badge">{{ tierLabels[hit.tier - 1] }} ×{{ hit.hits }}</span>
                        }
                        @if (d.tierHits.length === 0) {
                          <span class="no-win">—</span>
                        }
                      </td>
                      <td [class.won]="d.prizeWon > 0">{{ formatCurrency(d.prizeWon) }}</td>
                      <td>{{ formatCurrency(d.ticketCost) }}</td>
                      <td>
                        @if (d.usedRealPrizes) {
                          <span class="prize-badge real">{{ 'simulate.real' | translate }}</span>
                        } @else {
                          <span class="prize-badge estimate">{{ 'simulate.estimate' | translate }}</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="empty">{{ 'simulate.noWins' | translate }}</p>
            }
          </div>
        </div>
      }
    </section>
  `,
  styles: [`
    .saved-loader {
      margin: 12px 0;
      padding: 12px;
      background: var(--bg);
      border-radius: 6px;
    }
    .saved-title {
      display: block;
      font-size: 13px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }
    .saved-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .saved-item {
      display: flex;
      align-items: center;
      padding: 8px 10px;
      border: 2px solid transparent;
      border-radius: 8px;
      background: var(--card-bg, var(--surface-card));
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .saved-item:hover {
      border-color: var(--primary-color, #3b82f6);
    }
    .saved-item.selected {
      border-color: var(--primary-color, #3b82f6);
      background: var(--primary-soft, rgba(59, 130, 246, 0.1));
    }
    .saved-hint { font-size: 12px; color: var(--text-secondary); }
    .form-grid { display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }
    .form-row { display: flex; flex-direction: column; gap: 4px; min-width: 140px; }
    .form-row label { font-size: 13px; color: var(--text-secondary); }
    input, select { padding: 8px; border: 1px solid var(--border); border-radius: 4px; }
    .selected-section {
      margin: 16px 0;
      padding: 12px;
      background: var(--bg);
      border-radius: 6px;
    }
    .selected-section .label { font-size: 14px; color: var(--text-secondary); display: block; margin-bottom: 8px; }
    .selected-balls { display: flex; gap: 6px; flex-wrap: wrap; }
    .selected-balls app-lottery-ball { cursor: pointer; }
    .clear-btn { margin-top: 10px; font-size: 12px; padding: 4px 12px; }
    .pick-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 16px 0;
      max-width: 500px;
    }
    .pick-grid app-lottery-ball { cursor: pointer; }
    .strong-section { margin: 16px 0; }
    .strong-section .label { font-size: 14px; color: var(--text-secondary); display: block; margin-bottom: 8px; }
    .strong-balls { display: flex; gap: 8px; }
    .strong-ball {
      width: 36px; height: 36px;
      border-radius: 50%;
      border: 2px solid var(--border);
      background: var(--card-bg);
      color: var(--text);
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .strong-ball.selected {
      background: var(--ball-strong, #1976d2);
      color: #fff;
      border-color: var(--ball-strong, #1976d2);
    }
    .strong-ball:hover { border-color: var(--ball-strong, #1976d2); }
    .prize-config { margin: 16px 0; }
    .prize-header {
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 0;
    }
    .expand-icon { font-size: 12px; color: var(--text-secondary); }
    .prize-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 8px;
      padding: 12px;
      background: var(--bg);
      border-radius: 6px;
    }
    .prize-row { display: flex; flex-direction: column; gap: 4px; }
    .prize-row label { font-size: 12px; color: var(--text-secondary); }
    .prize-row input { padding: 4px 8px; font-size: 13px; }
    .results { margin-top: 24px; }
    .results h3 { font-size: 15px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .summary-card {
      padding: 16px;
      background: var(--bg);
      border-radius: 8px;
      text-align: center;
    }
    .summary-label { display: block; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px; }
    .summary-value { display: block; font-size: 20px; font-weight: 700; }
    .summary-value.spent { color: var(--text-secondary); }
    .summary-value.won { color: #2e7d32; }
    .summary-value.profit { color: #2e7d32; }
    .summary-value.loss { color: #c62828; }
    .summary-value.real { color: #1565c0; font-size: 16px; }
    .prize-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .prize-badge.real { background: rgba(21, 101, 192, 0.15); color: #1565c0; }
    .prize-badge.estimate { background: rgba(255, 152, 0, 0.15); color: #e65100; }
    .tier-summary { margin: 16px 0; }
    .tier-summary h4 { font-size: 14px; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: start; padding: 8px; border-bottom: 2px solid var(--border); color: var(--text-secondary); font-size: 12px; }
    td { padding: 8px; border-bottom: 1px solid var(--border); }
    tr.has-hits { background: rgba(46, 125, 50, 0.08); }
    .draws-section { margin-top: 24px; }
    .draws-section h4 { font-size: 14px; margin-bottom: 8px; }
    .draws-table { font-size: 12px; }
    .winning-balls { display: flex; gap: 4px; flex-wrap: wrap; }
    .mini-ball {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px; height: 24px;
      border-radius: 50%;
      background: var(--ball-regular, #e53935);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .mini-ball.strong { background: var(--ball-strong, #1976d2); }
    .tier-badge {
      display: inline-block;
      padding: 2px 8px;
      margin: 2px;
      background: var(--primary);
      color: #fff;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .no-win { color: var(--text-secondary); }
    td.won { color: #2e7d32; font-weight: 600; }
    .empty { color: var(--text-secondary); }
  `],
})
export class SimulateComponent {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  protected lang = inject(LanguageService);
  private archive = inject(ArchiveWindowService);
  private destroyRef = inject(DestroyRef);

  formSizes = [6, 8, 10, 12];
  formSize = 6;
  ticketCost = DEFAULT_TICKET_COST;
  strongNumbers = [1, 2, 3, 4, 5, 6, 7];
  tierLabels = TIER_LABELS;
  prizeAmounts = [...DEFAULT_PRIZE_AMOUNTS];

  private readonly _selected = signal<number[]>([]);
  readonly selected = computed(() => this._selected());
  readonly strong = signal(0);
  readonly showPrizeConfig = signal(false);

  /** True when the archive date range is valid (from <= to, both non-empty). */
  readonly dateRangeValid = computed(() => {
    const f = this.archive.from();
    const t = this.archive.to();
    return !!f && !!t && f <= t;
  });

  // Saved numbers state
  readonly savedSets = signal<SavedNumbersResponse[]>([]);
  readonly savedLoading = signal(false);
  readonly selectedSavedId = signal(0);

  result = signal<SimulateResultResponse | null>(null);

  constructor() {
    this.loadSavedNumbers();
  }

  readonly choices = computed(() => {
    const selectedSet = new Set(this._selected());
    const all: number[] = [];
    for (let i = 1; i <= 37; i++) {
      if (!selectedSet.has(i)) all.push(i);
    }
    return all;
  });

  readonly summary = computed(() => this.result()?.summary ?? {
    totalDraws: 0, totalCombinations: 0, totalSpent: 0, totalWon: 0, net: 0, tierSummaries: [], drawsWithRealPrizes: 0,
  });

  readonly winningDraws = computed(() => {
    const draws = this.result()?.draws ?? [];
    // Show all draws, but sort by date descending for readability
    return [...draws].sort((a, b) => b.drawDate.localeCompare(a.drawDate));
  });

  onFormSizeChange(): void {
    // If user has more numbers selected than the new form size, trim
    if (this._selected().length > this.formSize) {
      this._selected.set(this._selected().slice(0, this.formSize));
    }
  }

  addNumber(n: number): void {
    if (this._selected().length >= this.formSize) {
      this.toast.info(this.lang.t('simulate.maxNumbers', { n: this.formSize }));
      return;
    }
    this._selected.update((arr) => [...arr, n].sort((a, b) => a - b));
  }

  removeNumber(i: number): void {
    this._selected.update((arr) => arr.filter((_, idx) => idx !== i));
  }

  clearNumbers(): void {
    this._selected.set([]);
    this.strong.set(0);
    this.result.set(null);
    this.selectedSavedId.set(0);
  }

  // ── Saved numbers loading ──────────────────────────────────

  loadSavedNumbers(): void {
    this.savedLoading.set(true);
    this.api.getSavedNumbers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        // Only show sets with 6-12 numbers (valid form sizes)
        const valid = res.filter((s) => s.numbers.length >= 6 && s.numbers.length <= 12);
        this.savedSets.set(valid);
        this.savedLoading.set(false);
      },
      error: () => {
        // Non-critical — just don't show the loader
        this.savedLoading.set(false);
      },
    });
  }

  loadSavedSet(id: number): void {
    this.selectedSavedId.set(id);
    if (id === 0) return;

    const set = this.savedSets().find((s) => s.id === id);
    if (!set) return;

    const nums = set.numbers;
    const size = nums.length;

    // Adjust form size to match the saved set (capped at 12)
    const newFormSize = Math.min(size, 12);
    this.formSize = newFormSize;
    this._selected.set([...nums].sort((a, b) => a - b));

    // Set strong number if the saved set has one (willBe is an array; use first element)
    if (set.willBe && set.willBe.length > 0) {
      const s = set.willBe[0];
      if (s >= 1 && s <= 7) {
        this.strong.set(s);
      }
    }

    // Clear previous results
    this.result.set(null);

    this.toast.info(this.lang.t('simulate.loadedSaved'));
  }

  simulate(): void {
    const formNums = this._selected();
    if (formNums.length !== this.formSize) {
      this.toast.info(this.lang.t('simulate.needNumbers', { n: this.formSize }));
      return;
    }
    if (this.strong() === 0) {
      this.toast.info(this.lang.t('simulate.needStrong'));
      return;
    }

    const req: SimulateRequest = {
      form: formNums,
      strong: this.strong(),
      from: this.archive.from(),
      to: this.archive.to(),
      ticketCost: this.ticketCost,
      prizeAmounts: [...this.prizeAmounts],
    };

    subscribeWithError({
      observable: this.api.simulate(req),
      toast: this.toast,
      lang: this.lang,
      destroyRef: this.destroyRef,
      next: (res) => {
        this.result.set(res);
      },
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('he-IL', {
      style: 'currency',
      currency: 'ILS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
