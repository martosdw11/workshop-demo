import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'src/server/db/migrations/**',
    ],
  },

  {
    rules: {
      // Variabel/argumen tak terpakai boleh diawali `_` (pola umum di handler & destructuring)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Import type dipisahkan agar tidak ikut ke bundle runtime
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'smart'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  /**
   * Aturan batas layer (TDD §1.3).
   * `features/**` berjalan di client — dilarang menyentuh apa pun di `server/**`.
   * Akses data dari client HANYA lewat `lib/api-client.ts`.
   */
  {
    files: ['src/features/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/*', '@/server/**', '**/server/db/**', '**/server/services/**'],
              message:
                'features/ dan components/ berjalan di client — dilarang import dari server/**. Akses data lewat lib/api-client.ts (TDD §1.3).',
            },
          ],
        },
      ],
    },
  },

  /**
   * Larangan hex literal di komponen (TDD §6.1).
   * Warna wajib lewat token Tailwind; satu-satunya tempat nilai warna literal
   * boleh muncul adalah src/styles/globals.css.
   */
  {
    files: ['src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Dilarang menulis hex color literal di komponen. Pakai token design system (mis. `bg-primary`, `text-on-surface`) — TDD §6.1.',
        },
        {
          selector: 'TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}\\b/]',
          message:
            'Dilarang menulis hex color literal di komponen. Pakai token design system (mis. `bg-primary`, `text-on-surface`) — TDD §6.1.',
        },
      ],
    },
  },

  // Script CLI Node (migrate, seed, reset, tooling) memang berkomunikasi lewat stdout
  {
    files: [
      'src/server/db/migrate.ts',
      'src/server/db/reset.ts',
      'src/server/db/seed*.ts',
      'scripts/**/*.ts',
      'drizzle.config.ts',
      'tests/e2e/helpers/clear-rate-limits.ts',
    ],
    rules: { 'no-console': 'off' },
  },

  // Harus terakhir: mematikan rule format yang bentrok dengan Prettier
  prettierConfig,
];

export default eslintConfig;
