export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      secondary: 'graphite',
      neutral: 'graphite',
      success: 'emerald',
      info: 'cyan',
      warning: 'amber',
      error: 'red'
    },
    card: {
      slots: {
        root: 'bg-default ring-default rounded-lg shadow-none',
        header: 'p-4 sm:px-5',
        body: 'p-4 sm:p-5',
        footer: 'p-4 sm:px-5'
      }
    },
    button: {
      slots: { base: 'font-medium' }
    }
  }
})
