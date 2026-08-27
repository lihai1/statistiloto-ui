import { EnvironmentProviders, inject, provideAppInitializer } from '@angular/core';
import { SwUpdate, provideServiceWorker } from '@angular/service-worker';
import { environment } from '../../environments/environment';

export namespace ServiceWorker {
  export function registerProvider(): EnvironmentProviders {
    return provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    });
  }

  /**
   * Checks for available SW updates on app start and activates them immediately.
   * Without this, users may see stale cached bundles after a redeploy until all
   * tabs are closed and reopened.
   */
  export function updateProvider(): EnvironmentProviders {
    return provideAppInitializer(() => {
      const updates = inject(SwUpdate);
      if (!updates.isEnabled) return;

      // Check for an update that was already downloaded on a previous load.
      updates.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') {
          // Reload to activate the new version immediately.
          document.location.reload();
        }
      });

      // Poll for a new version on startup.
      updates.checkForUpdate().catch(() => {
        // Swallow — non-critical.
      });
    });
  }
}
