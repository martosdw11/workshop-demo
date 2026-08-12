'use client';

import { MaterialIcon } from '@/components/shared/MaterialIcon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * SsoButtonsDisabled — TDD §6.3 & §5.3.
 *
 * Login Google/SSO **out of scope MVP** (§2 PRD). Tombolnya ada karena ada di
 * acuan desain, tetapi: `disabled`, TANPA `onClick`, TANPA `href`, dan tanpa
 * satu pun route/env terkait. Tooltip "Coming soon" adalah satu-satunya perilaku.
 *
 * Logo Google resmi tidak dipakai: SVG-nya membawa warna merek dalam bentuk hex
 * literal, yang dilarang di `.tsx` (§6.1). Ikon netral dari Material Symbols
 * dipakai sebagai gantinya.
 */
const PROVIDERS = [
  { id: 'google', label: 'Google', icon: 'account_circle' },
  { id: 'sso', label: 'SSO', icon: 'corporate_fare' },
];

export function SsoButtonsDisabled() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {PROVIDERS.map((provider) => (
        <Tooltip key={provider.id}>
          <TooltipTrigger asChild>
            {/* `span` pembungkus: elemen `disabled` tidak memancarkan event
                pointer, sehingga tooltip-nya tidak akan pernah muncul. */}
            <span tabIndex={0} className="rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-2 text-label-md text-on-surface opacity-60"
              >
                <MaterialIcon name={provider.icon} />
                {provider.label}
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
