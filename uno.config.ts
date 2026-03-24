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
    pipeline: {
      exclude: [
        'node_modules',
        'dist',
        '.next',
        '.worktree',
        'out',
        'build',
        '**/.next/**',
        '**/.worktree/**',
      ],
    }
  },
})