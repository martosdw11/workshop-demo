import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';
import animate from 'tailwindcss-animate';

/**
 * Token diambil APA ADANYA dari design system "Adaptive Scholastic Narrative"
 * (doc/stitch_learning_study_ai_platform/adaptive_scholastic_narrative/DESIGN.md)
 * dan PRD §7.3–§7.5. Setup produksi — bukan Tailwind CDN seperti pada mockup HTML.
 *
 * Nilai warna hidup sebagai CSS variable di `src/styles/globals.css` supaya dark
 * mode (PRD §7.7) cukup menukar nilai variabel tanpa menyentuh satu pun komponen.
 * Fungsi `token()` di bawah menjaga modifier opacity Tailwind tetap bekerja
 * (`bg-error/80` untuk segmen Stalled pada Event Pipeline).
 */
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',

      // Surface & background
      background: token('background'),
      'on-background': token('on-background'),
      surface: token('surface'),
      'surface-dim': token('surface-dim'),
      'surface-bright': token('surface-bright'),
      'surface-container-lowest': token('surface-container-lowest'),
      'surface-container-low': token('surface-container-low'),
      'surface-container': token('surface-container'),
      'surface-container-high': token('surface-container-high'),
      'surface-container-highest': token('surface-container-highest'),
      'surface-variant': token('surface-variant'),
      'surface-tint': token('surface-tint'),

      // Teks & outline
      'on-surface': token('on-surface'),
      'on-surface-variant': token('on-surface-variant'),
      'inverse-surface': token('inverse-surface'),
      'inverse-on-surface': token('inverse-on-surface'),
      outline: token('outline'),
      'outline-variant': token('outline-variant'),

      // Primary — aksi utama, nav, kategori respons "Jawaban"
      primary: token('primary'),
      'on-primary': token('on-primary'),
      'primary-container': token('primary-container'),
      'on-primary-container': token('on-primary-container'),
      'inverse-primary': token('inverse-primary'),
      'primary-fixed': token('primary-fixed'),
      'primary-fixed-dim': token('primary-fixed-dim'),
      'on-primary-fixed': token('on-primary-fixed'),
      'on-primary-fixed-variant': token('on-primary-fixed-variant'),

      // Secondary — status In Progress
      secondary: token('secondary'),
      'on-secondary': token('on-secondary'),
      'secondary-container': token('secondary-container'),
      'on-secondary-container': token('on-secondary-container'),
      'secondary-fixed': token('secondary-fixed'),
      'secondary-fixed-dim': token('secondary-fixed-dim'),
      'on-secondary-fixed': token('on-secondary-fixed'),
      'on-secondary-fixed-variant': token('on-secondary-fixed-variant'),

      // Tertiary — poin & achievement
      tertiary: token('tertiary'),
      'on-tertiary': token('on-tertiary'),
      'tertiary-container': token('tertiary-container'),
      'on-tertiary-container': token('on-tertiary-container'),
      'tertiary-fixed': token('tertiary-fixed'),
      'tertiary-fixed-dim': token('tertiary-fixed-dim'),
      'on-tertiary-fixed': token('on-tertiary-fixed'),
      'on-tertiary-fixed-variant': token('on-tertiary-fixed-variant'),

      // Error — Issue / blocker / bottleneck
      error: token('error'),
      'on-error': token('on-error'),
      'error-container': token('error-container'),
      'on-error-container': token('on-error-container'),
    },

    // Baseline 4px (DESIGN.md → Layout & Spacing)
    spacing: {
      0: '0px',
      px: '1px',
      0.5: '2px',
      1: '4px',
      1.5: '6px',
      2: '8px',
      3: '12px',
      4: '16px',
      5: '20px',
      6: '24px',
      7: '28px',
      8: '32px',
      10: '40px',
      11: '44px', // tinggi minimum tombol / touch target (§7.6 PRD)
      12: '48px',
      14: '56px',
      16: '64px', // tinggi TopNavBar
      20: '80px',
      24: '96px',
      32: '128px',
      40: '160px',
      44: '176px',
      48: '192px',
      56: '224px',
      64: '256px', // lebar AdminSideNav (w-64)
      72: '288px',
      80: '320px', // lebar LearningPathSidebar (w-80)
      96: '384px',
      // Alias semantik dari DESIGN.md
      'stack-sm': '0.5rem', // 8px  — jarak antar elemen dalam kartu
      'stack-md': '1rem', // 16px — padding internal komponen
      'stack-lg': '2rem', // 32px — jarak antar section besar
      gutter: '1.5rem', // 24px — jarak antar blok utama
      'container-mobile': '1rem',
      'container-desktop': '2rem',
    },

    borderRadius: {
      none: '0px',
      sm: '0.25rem', // 4px  — checkbox, badge kecil
      DEFAULT: '0.5rem', // 8px
      md: '0.75rem', // 12px
      /**
       * ASUMSI EKSPLISIT (A-F01): frontmatter DESIGN.md menulis `lg: 1rem` (16px),
       * sementara PRD §7.5 dan prosa DESIGN.md ("Main Components: Buttons, Cards,
       * and Inputs use `rounded-lg` (12px)") menulis 12px untuk token yang SAMA.
       * Yang dimenangkan adalah PRD + prosa DESIGN.md, karena keduanya menyebut
       * angka radius yang mengikat komponen. Akibatnya `rounded-md` dan
       * `rounded-lg` sama-sama 12px — disengaja, supaya primitif shadcn/ui yang
       * memakai `rounded-md` tetap menghasilkan radius produksi yang benar.
       */
      lg: '0.75rem', // 12px — tombol, kartu, input (PRD §7.5)
      xl: '1.5rem', // 24px — modal & sheet
      full: '9999px', // pill badge
    },

    fontSize: {
      // [ukuran, { lineHeight, letterSpacing, fontWeight }] — skala §7.3 PRD
      display: ['36px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
      'headline-lg': ['30px', { lineHeight: '38px', letterSpacing: '-0.01em', fontWeight: '600' }],
      'headline-lg-mobile': ['24px', { lineHeight: '32px', fontWeight: '600' }],
      'headline-md': ['24px', { lineHeight: '32px', fontWeight: '600' }],
      'title-lg': ['20px', { lineHeight: '28px', fontWeight: '600' }],
      'title-md': ['16px', { lineHeight: '24px', fontWeight: '600' }],
      'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
      'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
      'body-sm': ['14px', { lineHeight: '20px', fontWeight: '400' }],
      'label-md': ['14px', { lineHeight: '20px', fontWeight: '500' }],
      'label-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '500' }],
    },

    extend: {
      fontFamily: {
        // Inter eksklusif (§7.3 PRD), di-self-host lewat next/font (src/app/layout.tsx)
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      /**
       * `theme.colors` diganti total (bukan extend), sehingga fallback bawaan
       * Tailwind (`gray.200`) hilang dan `border` polos akan jatuh ke
       * `currentColor` — menghasilkan garis berwarna teks. Level 1 elevasi
       * DESIGN.md memakai border 1px `outline-variant`, jadi itulah defaultnya.
       */
      borderColor: { DEFAULT: token('outline-variant') },
      ringColor: { DEFAULT: token('primary') },
      divideColor: { DEFAULT: token('outline-variant') },

      // Grid 12 kolom desktop / 8 tablet / 4 mobile (§2 PRD)
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px', // ambang desktop 12 kolom
        '2xl': '1536px',
      },

      boxShadow: {
        // Level 1 kartu memakai border 1px (bukan shadow); Level 2 dropdown/modal:
        level2: '0 4px 12px 0 rgb(0 0 0 / 0.05)',
      },

      // Progress bar setinggi 6px dengan track membulat (§7.6 PRD)
      height: { progress: '6px' },

      outlineWidth: { 2: '2px' },

      /**
       * Animasi masuk/keluar Radix (dialog, sheet, dropdown, tooltip) dijalankan
       * `tailwindcss-animate` lewat `data-[state=…]`. Keyframes slide khusus
       * dibutuhkan `Sheet` karena ia masuk dari tepi layar, bukan dari pusat.
       */
      keyframes: {
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-out-right': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(100%)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-out-left': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-100%)' } },
      },
      animation: {
        'slide-in-right': 'slide-in-right 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-right': 'slide-out-right 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-left': 'slide-in-left 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-left': 'slide-out-left 200ms cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [typography, animate],
};

export default config;
