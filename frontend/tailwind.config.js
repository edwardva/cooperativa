/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ============================================
        // DESIGN SYSTEM - Cooperativa el Triunfo
        // Paleta basada en el logo original: naranja, verde y rojo
        // ============================================
        
        // ============================================
        // Las paletas se resuelven contra variables CSS (src/styles/theme.css)
        // para que la misma clase sirva en tema diurno y nocturno.
        // Los valores originales viven ahi; no editar hex aca.
        // ============================================

        primary: {
          50: 'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: 'rgb(var(--c-primary-300) / <alpha-value>)',
          400: 'rgb(var(--c-primary-400) / <alpha-value>)',
          500: 'rgb(var(--c-primary-500) / <alpha-value>)',
          600: 'rgb(var(--c-primary-600) / <alpha-value>)',
          700: 'rgb(var(--c-primary-700) / <alpha-value>)',
          800: 'rgb(var(--c-primary-800) / <alpha-value>)',
          900: 'rgb(var(--c-primary-900) / <alpha-value>)',
          950: 'rgb(var(--c-primary-950) / <alpha-value>)',
        },

        secondary: {
          50: 'rgb(var(--c-secondary-50) / <alpha-value>)',
          100: 'rgb(var(--c-secondary-100) / <alpha-value>)',
          200: 'rgb(var(--c-secondary-200) / <alpha-value>)',
          300: 'rgb(var(--c-secondary-300) / <alpha-value>)',
          400: 'rgb(var(--c-secondary-400) / <alpha-value>)',
          500: 'rgb(var(--c-secondary-500) / <alpha-value>)',
          600: 'rgb(var(--c-secondary-600) / <alpha-value>)',
          700: 'rgb(var(--c-secondary-700) / <alpha-value>)',
          800: 'rgb(var(--c-secondary-800) / <alpha-value>)',
          900: 'rgb(var(--c-secondary-900) / <alpha-value>)',
          950: 'rgb(var(--c-secondary-950) / <alpha-value>)',
        },

        success: {
          50: 'rgb(var(--c-success-50) / <alpha-value>)',
          100: 'rgb(var(--c-success-100) / <alpha-value>)',
          200: 'rgb(var(--c-success-200) / <alpha-value>)',
          300: 'rgb(var(--c-success-300) / <alpha-value>)',
          400: 'rgb(var(--c-success-400) / <alpha-value>)',
          500: 'rgb(var(--c-success-500) / <alpha-value>)',
          600: 'rgb(var(--c-success-600) / <alpha-value>)',
          700: 'rgb(var(--c-success-700) / <alpha-value>)',
          800: 'rgb(var(--c-success-800) / <alpha-value>)',
          900: 'rgb(var(--c-success-900) / <alpha-value>)',
        },

        neutral: {
          50: 'rgb(var(--c-neutral-50) / <alpha-value>)',
          100: 'rgb(var(--c-neutral-100) / <alpha-value>)',
          200: 'rgb(var(--c-neutral-200) / <alpha-value>)',
          300: 'rgb(var(--c-neutral-300) / <alpha-value>)',
          400: 'rgb(var(--c-neutral-400) / <alpha-value>)',
          500: 'rgb(var(--c-neutral-500) / <alpha-value>)',
          600: 'rgb(var(--c-neutral-600) / <alpha-value>)',
          700: 'rgb(var(--c-neutral-700) / <alpha-value>)',
          800: 'rgb(var(--c-neutral-800) / <alpha-value>)',
          900: 'rgb(var(--c-neutral-900) / <alpha-value>)',
          950: 'rgb(var(--c-neutral-950) / <alpha-value>)',
        },

        accent: {
          50: 'rgb(var(--c-accent-50) / <alpha-value>)',
          100: 'rgb(var(--c-accent-100) / <alpha-value>)',
          200: 'rgb(var(--c-accent-200) / <alpha-value>)',
          300: 'rgb(var(--c-accent-300) / <alpha-value>)',
          400: 'rgb(var(--c-accent-400) / <alpha-value>)',
          500: 'rgb(var(--c-accent-500) / <alpha-value>)',
          600: 'rgb(var(--c-accent-600) / <alpha-value>)',
          700: 'rgb(var(--c-accent-700) / <alpha-value>)',
          800: 'rgb(var(--c-accent-800) / <alpha-value>)',
          900: 'rgb(var(--c-accent-900) / <alpha-value>)',
        },

        warning: {
          50: 'rgb(var(--c-warning-50) / <alpha-value>)',
          100: 'rgb(var(--c-warning-100) / <alpha-value>)',
          200: 'rgb(var(--c-warning-200) / <alpha-value>)',
          300: 'rgb(var(--c-warning-300) / <alpha-value>)',
          400: 'rgb(var(--c-warning-400) / <alpha-value>)',
          500: 'rgb(var(--c-warning-500) / <alpha-value>)',
          600: 'rgb(var(--c-warning-600) / <alpha-value>)',
          700: 'rgb(var(--c-warning-700) / <alpha-value>)',
          800: 'rgb(var(--c-warning-800) / <alpha-value>)',
          900: 'rgb(var(--c-warning-900) / <alpha-value>)',
        },

        error: {
          50: 'rgb(var(--c-error-50) / <alpha-value>)',
          100: 'rgb(var(--c-error-100) / <alpha-value>)',
          200: 'rgb(var(--c-error-200) / <alpha-value>)',
          300: 'rgb(var(--c-error-300) / <alpha-value>)',
          400: 'rgb(var(--c-error-400) / <alpha-value>)',
          500: 'rgb(var(--c-error-500) / <alpha-value>)',
          600: 'rgb(var(--c-error-600) / <alpha-value>)',
          700: 'rgb(var(--c-error-700) / <alpha-value>)',
          800: 'rgb(var(--c-error-800) / <alpha-value>)',
          900: 'rgb(var(--c-error-900) / <alpha-value>)',
        },

        gray: {
          50: 'rgb(var(--c-gray-50) / <alpha-value>)',
          100: 'rgb(var(--c-gray-100) / <alpha-value>)',
          200: 'rgb(var(--c-gray-200) / <alpha-value>)',
          300: 'rgb(var(--c-gray-300) / <alpha-value>)',
          400: 'rgb(var(--c-gray-400) / <alpha-value>)',
          500: 'rgb(var(--c-gray-500) / <alpha-value>)',
          600: 'rgb(var(--c-gray-600) / <alpha-value>)',
          700: 'rgb(var(--c-gray-700) / <alpha-value>)',
          800: 'rgb(var(--c-gray-800) / <alpha-value>)',
          900: 'rgb(var(--c-gray-900) / <alpha-value>)',
          950: 'rgb(var(--c-gray-950) / <alpha-value>)',
        },

        emerald: {
          50: 'rgb(var(--c-emerald-50) / <alpha-value>)',
          100: 'rgb(var(--c-emerald-100) / <alpha-value>)',
          200: 'rgb(var(--c-emerald-200) / <alpha-value>)',
          300: 'rgb(var(--c-emerald-300) / <alpha-value>)',
          400: 'rgb(var(--c-emerald-400) / <alpha-value>)',
          500: 'rgb(var(--c-emerald-500) / <alpha-value>)',
          600: 'rgb(var(--c-emerald-600) / <alpha-value>)',
          700: 'rgb(var(--c-emerald-700) / <alpha-value>)',
          800: 'rgb(var(--c-emerald-800) / <alpha-value>)',
          900: 'rgb(var(--c-emerald-900) / <alpha-value>)',
          950: 'rgb(var(--c-emerald-950) / <alpha-value>)',
        },

        amber: {
          50: 'rgb(var(--c-amber-50) / <alpha-value>)',
          100: 'rgb(var(--c-amber-100) / <alpha-value>)',
          200: 'rgb(var(--c-amber-200) / <alpha-value>)',
          300: 'rgb(var(--c-amber-300) / <alpha-value>)',
          400: 'rgb(var(--c-amber-400) / <alpha-value>)',
          500: 'rgb(var(--c-amber-500) / <alpha-value>)',
          600: 'rgb(var(--c-amber-600) / <alpha-value>)',
          700: 'rgb(var(--c-amber-700) / <alpha-value>)',
          800: 'rgb(var(--c-amber-800) / <alpha-value>)',
          900: 'rgb(var(--c-amber-900) / <alpha-value>)',
          950: 'rgb(var(--c-amber-950) / <alpha-value>)',
        },

        rose: {
          50: 'rgb(var(--c-rose-50) / <alpha-value>)',
          100: 'rgb(var(--c-rose-100) / <alpha-value>)',
          200: 'rgb(var(--c-rose-200) / <alpha-value>)',
          300: 'rgb(var(--c-rose-300) / <alpha-value>)',
          400: 'rgb(var(--c-rose-400) / <alpha-value>)',
          500: 'rgb(var(--c-rose-500) / <alpha-value>)',
          600: 'rgb(var(--c-rose-600) / <alpha-value>)',
          700: 'rgb(var(--c-rose-700) / <alpha-value>)',
          800: 'rgb(var(--c-rose-800) / <alpha-value>)',
          900: 'rgb(var(--c-rose-900) / <alpha-value>)',
          950: 'rgb(var(--c-rose-950) / <alpha-value>)',
        },

        red: {
          50: 'rgb(var(--c-red-50) / <alpha-value>)',
          100: 'rgb(var(--c-red-100) / <alpha-value>)',
          200: 'rgb(var(--c-red-200) / <alpha-value>)',
          300: 'rgb(var(--c-red-300) / <alpha-value>)',
          400: 'rgb(var(--c-red-400) / <alpha-value>)',
          500: 'rgb(var(--c-red-500) / <alpha-value>)',
          600: 'rgb(var(--c-red-600) / <alpha-value>)',
          700: 'rgb(var(--c-red-700) / <alpha-value>)',
          800: 'rgb(var(--c-red-800) / <alpha-value>)',
          900: 'rgb(var(--c-red-900) / <alpha-value>)',
          950: 'rgb(var(--c-red-950) / <alpha-value>)',
        },

        indigo: {
          50: 'rgb(var(--c-indigo-50) / <alpha-value>)',
          100: 'rgb(var(--c-indigo-100) / <alpha-value>)',
          200: 'rgb(var(--c-indigo-200) / <alpha-value>)',
          300: 'rgb(var(--c-indigo-300) / <alpha-value>)',
          400: 'rgb(var(--c-indigo-400) / <alpha-value>)',
          500: 'rgb(var(--c-indigo-500) / <alpha-value>)',
          600: 'rgb(var(--c-indigo-600) / <alpha-value>)',
          700: 'rgb(var(--c-indigo-700) / <alpha-value>)',
          800: 'rgb(var(--c-indigo-800) / <alpha-value>)',
          900: 'rgb(var(--c-indigo-900) / <alpha-value>)',
          950: 'rgb(var(--c-indigo-950) / <alpha-value>)',
        },

        purple: {
          50: 'rgb(var(--c-purple-50) / <alpha-value>)',
          100: 'rgb(var(--c-purple-100) / <alpha-value>)',
          200: 'rgb(var(--c-purple-200) / <alpha-value>)',
          300: 'rgb(var(--c-purple-300) / <alpha-value>)',
          400: 'rgb(var(--c-purple-400) / <alpha-value>)',
          500: 'rgb(var(--c-purple-500) / <alpha-value>)',
          600: 'rgb(var(--c-purple-600) / <alpha-value>)',
          700: 'rgb(var(--c-purple-700) / <alpha-value>)',
          800: 'rgb(var(--c-purple-800) / <alpha-value>)',
          900: 'rgb(var(--c-purple-900) / <alpha-value>)',
          950: 'rgb(var(--c-purple-950) / <alpha-value>)',
        },

        blue: {
          50: 'rgb(var(--c-blue-50) / <alpha-value>)',
          100: 'rgb(var(--c-blue-100) / <alpha-value>)',
          200: 'rgb(var(--c-blue-200) / <alpha-value>)',
          300: 'rgb(var(--c-blue-300) / <alpha-value>)',
          400: 'rgb(var(--c-blue-400) / <alpha-value>)',
          500: 'rgb(var(--c-blue-500) / <alpha-value>)',
          600: 'rgb(var(--c-blue-600) / <alpha-value>)',
          700: 'rgb(var(--c-blue-700) / <alpha-value>)',
          800: 'rgb(var(--c-blue-800) / <alpha-value>)',
          900: 'rgb(var(--c-blue-900) / <alpha-value>)',
          950: 'rgb(var(--c-blue-950) / <alpha-value>)',
        },

        green: {
          50: 'rgb(var(--c-green-50) / <alpha-value>)',
          100: 'rgb(var(--c-green-100) / <alpha-value>)',
          200: 'rgb(var(--c-green-200) / <alpha-value>)',
          300: 'rgb(var(--c-green-300) / <alpha-value>)',
          400: 'rgb(var(--c-green-400) / <alpha-value>)',
          500: 'rgb(var(--c-green-500) / <alpha-value>)',
          600: 'rgb(var(--c-green-600) / <alpha-value>)',
          700: 'rgb(var(--c-green-700) / <alpha-value>)',
          800: 'rgb(var(--c-green-800) / <alpha-value>)',
          900: 'rgb(var(--c-green-900) / <alpha-value>)',
          950: 'rgb(var(--c-green-950) / <alpha-value>)',
        },

        orange: {
          50: 'rgb(var(--c-orange-50) / <alpha-value>)',
          100: 'rgb(var(--c-orange-100) / <alpha-value>)',
          200: 'rgb(var(--c-orange-200) / <alpha-value>)',
          300: 'rgb(var(--c-orange-300) / <alpha-value>)',
          400: 'rgb(var(--c-orange-400) / <alpha-value>)',
          500: 'rgb(var(--c-orange-500) / <alpha-value>)',
          600: 'rgb(var(--c-orange-600) / <alpha-value>)',
          700: 'rgb(var(--c-orange-700) / <alpha-value>)',
          800: 'rgb(var(--c-orange-800) / <alpha-value>)',
          900: 'rgb(var(--c-orange-900) / <alpha-value>)',
          950: 'rgb(var(--c-orange-950) / <alpha-value>)',
        },

        sky: {
          50: 'rgb(var(--c-sky-50) / <alpha-value>)',
          100: 'rgb(var(--c-sky-100) / <alpha-value>)',
          200: 'rgb(var(--c-sky-200) / <alpha-value>)',
          300: 'rgb(var(--c-sky-300) / <alpha-value>)',
          400: 'rgb(var(--c-sky-400) / <alpha-value>)',
          500: 'rgb(var(--c-sky-500) / <alpha-value>)',
          600: 'rgb(var(--c-sky-600) / <alpha-value>)',
          700: 'rgb(var(--c-sky-700) / <alpha-value>)',
          800: 'rgb(var(--c-sky-800) / <alpha-value>)',
          900: 'rgb(var(--c-sky-900) / <alpha-value>)',
          950: 'rgb(var(--c-sky-950) / <alpha-value>)',
        },

        white: 'rgb(var(--c-white) / <alpha-value>)',
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',
        black: 'rgb(var(--c-black) / <alpha-value>)',

        // Border
        border: 'hsl(214.3 31.8% 91.4%)',
        input: 'hsl(214.3 31.8% 91.4%)',
        ring: 'hsl(243 75% 59%)',
        
        // Background
        background: 'hsl(0 0% 100%)',
        foreground: 'hsl(222.2 84% 4.9%)',
        
        // Card
        card: 'hsl(0 0% 100%)',
        'card-foreground': 'hsl(222.2 84% 4.9%)',
        
        // Popover
        popover: 'hsl(0 0% 100%)',
        'popover-foreground': 'hsl(222.2 84% 4.9%)',
        
        // Muted
        muted: 'hsl(210 40% 96.1%)',
        'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
        
        // Accent
        accent: 'hsl(210 40% 96.1%)',
        'accent-foreground': 'hsl(222.2 47.4% 11.2%)',
        
        // Destructive
        destructive: 'hsl(0 84.2% 60.2%)',
        'destructive-foreground': 'hsl(210 40% 98%)',
      },
      
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      
      fontSize: {
        // Escala tipográfica moderna
        xs: ['0.75rem', { lineHeight: '1rem' }],      // 12px
        sm: ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
        base: ['1rem', { lineHeight: '1.5rem' }],     // 16px
        lg: ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
        xl: ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
        '2xl': ['1.5rem', { lineHeight: '2rem' }],    // 24px
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }], // 36px
        '5xl': ['3rem', { lineHeight: '1' }],         // 48px
      },
      
      spacing: {
        // Sistema base 4px
        '0.5': '0.125rem', // 2px
        '1': '0.25rem',    // 4px
        '1.5': '0.375rem', // 6px
        '2': '0.5rem',     // 8px
        '3': '0.75rem',    // 12px
        '4': '1rem',       // 16px
        '5': '1.25rem',    // 20px
        '6': '1.5rem',     // 24px
        '8': '2rem',       // 32px
        '10': '2.5rem',    // 40px
        '12': '3rem',      // 48px
        '16': '4rem',      // 64px
        '20': '5rem',      // 80px
        '24': '6rem',      // 96px
      },
      
      borderRadius: {
        sm: '0.25rem',  // 4px
        DEFAULT: '0.5rem', // 8px
        md: '0.5rem',   // 8px
        lg: '0.75rem',  // 12px
        xl: '1rem',     // 16px
        '2xl': '1.5rem', // 24px
        '3xl': '2rem',  // 32px
      },
      
      boxShadow: {
        // Sombras sutiles modernas
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
      },
      
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'fade-out': 'fadeOut 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-out': 'slideOut 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
      },
      
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeOut: {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        slideIn: {
          from: { transform: 'translateY(-10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        slideOut: {
          from: { transform: 'translateY(0)', opacity: '1' },
          to: { transform: 'translateY(-10px)', opacity: '0' },
        },
        scaleIn: {
          from: { transform: 'scale(0.95)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
