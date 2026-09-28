/** @type {import('tailwindcss').Config} */

const plugin = require('tailwindcss/plugin');

const tailwindConfig = {
  content: ['./*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}', './stories/components/**/*.{js,jsx,ts,tsx}'],
  theme: {
     
    fontFamily: {
      'NotoSans':['NotoSansJP_400Regular','sans-serif'],
      'Hiragino Sans':['Hiragino Sans','sans-serif'],
    },
    /*
    fontFamily:{
      'sans':['SFText','SF Display', 'Roboto','HiraginoSans','NotoSans']
    }, */
    fontSize:{
      xxs: ['10px', '16px'], 
      xs: ['12px', '16px'], 
      sm: ['14px', '20px'], 
      base: ['16px', '24px'],
      lg: ['18px', '28px'], 
      xl: ['20px', '28px'],
      xxl: ['24px', '32px'],
      xxxxl: ['30px', '36px'],
      xxxxxl: ['36px', '40px'],
    },
    extend: {
      left:{
        '5px':'5px',
      },
      top:{
        '5px':'5px',
      },
      colors: {
        'background': '#F7F7F7',
        'primary': '#3F3F3F',
        'secondary': '#727272',
        'tertiary': '#BABABA',
        'quaternary': '#ECECEC',
        'text-workbookblue': '#289DF4',
        'workbookblue': {
          50: '#E4F3FD',
          100: '#BCE0FB',
          200: '#92CDF9',
          300: '#68B9F6',
          400: '#47AAF6',
          500: '#289DF4',
          600: '#238DE6',
          700: '#1C7BD3',
          800: '#176AC1',
          900: '#0C4CA2'
        },
        'successgreen': {
          50: '#E9F6E9',
          200: '#A7DBA5',
          400: '#66C365',
        },
        'errorred': {
          50: '#FFEDF0',
          100: '#FFD1D7',
          400: '#FF5D5E',
        },
        'cautionyellow': {
          50: '#FEFEE7',
          200: '#F8F899',
          300: '#F9F871',
        },
        'calendar': {
          'R': '#FF8181',
          'RO': '#FFA984',
          'O': '#FFD28F',
          'Y': '#FCFEA2',
          'YG': '#DAF5A0',
          'G': '#B4F2B2',
          'BG': '#7CE2BE',
          'B': '#7C94EA',
          'BV': '#C3ABF5',
          'V': '#E8B1F1',
          'RV': '#F992C3'
        },


      },
    },
  },
  plugins: [
    plugin(({addUtilities})=>{
      addUtilities (
        {
          clipPath_round:{
            clipPath:`inset(0 round 16px)`
          },
          positionFixed:{
            position:`fixed`
          },
          positionSticky:{
            position:`sticky`
          },
        }
      );
    }),
  ],
};

export default tailwindConfig;