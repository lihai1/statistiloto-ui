import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, OperatorFunction } from 'rxjs';

import { LanguageService } from '../../core/i18n/language.service';
import { ToastService } from '../components/toast/toast.service';

/**
 * Shared HTTP loading + error handling for feature components.
 *
 * Components repeatedly duplicate this pattern:
 *
 * ```ts
 * this.toast.showLoading();
 * this.api.someCall(req)
 *   .pipe(takeUntilDestroyed(this.destroyRef))
 *   .subscribe({
 *     next: (res) => { this.toast.hideLoading(); ... },
 *     error: (err) => {
 *       this.toast.hideLoading();
 *       this.toast.error(err.message ?? this.lang.t('common.connectionError'));
 *     },
 *   });
 * ```
 *
 * `withLoading` centralizes the loading-toast lifecycle; `subscribeWithError`
 * centralizes the full subscribe pattern including the error toast.
 */

/**
 * Operator that shows the loading toast on subscribe and hides it on
 * next/error/complete. Use in a pipe before subscribe.
 */
export function withLoading<T>(toast: ToastService): OperatorFunction<T, T> {
  return (source: Observable<T>) => {
    toast.showLoading();
    return new Observable<T>((subscriber) => {
      const inner = source.subscribe({
        next: (v) => subscriber.next(v),
        error: (e) => {
          toast.hideLoading();
          subscriber.error(e);
        },
        complete: () => {
          toast.hideLoading();
          subscriber.complete();
        },
      });
      return () => inner.unsubscribe();
    });
  };
}

/**
 * Subscribe to an HTTP observable with the standard error-handling pattern:
 * hide loading on error and show a toast with the error message (or a
 * fallback connection-error translation).
 *
 * The `next` callback receives the successful response. Loading is hidden
 * automatically on next and on error.
 */
export function subscribeWithError<T>(options: {
  observable: Observable<T>;
  toast: ToastService;
  lang: LanguageService;
  destroyRef: DestroyRef;
  next: (value: T) => void;
  showLoading?: boolean;
  errorKey?: string;
}): void {
  const {
    observable,
    toast,
    lang,
    destroyRef,
    next,
    showLoading = true,
    errorKey = 'common.connectionError',
  } = options;

  if (showLoading) {
    toast.showLoading();
  }

  observable.pipe(takeUntilDestroyed(destroyRef)).subscribe({
    next: (value) => {
      if (showLoading) {
        toast.hideLoading();
      }
      next(value);
    },
    error: (err) => {
      if (showLoading) {
        toast.hideLoading();
      }
      toast.error(err.message ?? lang.t(errorKey));
    },
  });
}
