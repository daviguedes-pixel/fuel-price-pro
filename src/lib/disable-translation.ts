// Utility to hard-disable Google automatic translation effects across the app
export function disableAutoTranslate() {
  if (typeof window === 'undefined') return;
  
  try {
    // Wait for DOM to be ready
    const init = () => {
      const html = document.documentElement;
      const body = document.body;
      
      // Ensure language and notranslate attributes
      html.setAttribute('lang', 'pt-BR');
      html.setAttribute('translate', 'no');
      html.classList.add('notranslate');
      
      if (body) {
        body.setAttribute('translate', 'no');
        body.classList.add('notranslate');
      }

      // Apply to inputs periodically
      const applyToInputs = () => {
        try {
          const inputs = document.querySelectorAll('input, textarea, select');
          inputs.forEach((el) => {
            el.setAttribute('translate', 'no');
          });
        } catch (e) {
          // Silent fail
        }
      };

      applyToInputs();
      
      // Reapply every 2 seconds as fallback
      setInterval(applyToInputs, 2000);

      // Observer to remove translate classes
      try {
        const observer = new MutationObserver(() => {
          html.classList.remove('translated-ltr', 'translated-rtl');
        });

        observer.observe(html, {
          attributes: true,
          attributeFilter: ['class']
        });
      } catch (e) {
        // Silent fail
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  } catch (e) {
    // Never block app rendering
    console.warn('Translation disable warning:', e);
  }
}
