import { defineConfig, presetUno, presetIcons, presetTypography, transformerDirectives, transformerVariantGroup } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons({
      scale: 1.2,
      cdn: 'https://esm.sh/'
    }),
    presetTypography(),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  content: {
    filesystem: [
      'src/**/*.{html,js,ts,jsx,tsx,mdx,md}',
      'public/**/*.{html,js,ts,jsx,tsx,mdx,md}',
      '!public/games/babylon-rpg/runtime.js',
    ],
    pipeline: {
      exclude: [
        'node_modules',
        'dist',
        '.next',
        '.worktree',
        'out',
        'build',
        'public/games/babylon-rpg/runtime.js',
        '**/.next/**',
        '**/.worktree/**',
        '**/public/games/babylon-rpg/runtime.js',
      ],
    }
  },
})
