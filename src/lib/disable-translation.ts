// Utility to hard-disable Google automatic translation effects across the app
// - Adds translate="no" and notranslate class to key containers
// - Observes DOM mutations to revert Chrome/Google Translate injections (translated-ltr/rtl)
// - Marks interactive fields as non-translatable to avoid value corruption

export function disableAutoTranslate() {
  try {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    // Ensure language and notranslate attributes
    html.setAttribute('lang', 'pt-BR');
    html.setAttribute('translate', 'no');
    html.classList.add('notranslate');

    if (body) {
      body.setAttribute('translate', 'no');
      body.classList.add('notranslate');
    }
    if (root) {
      root.setAttribute('translate', 'no');
      root.classList.add('notranslate');
    }

    const applyNoTranslateToInputs = (scope: ParentNode = document) => {
      const inputs = scope.querySelectorAll('input, textarea, select, [contenteditable]');
      inputs.forEach((el) => {
        el.setAttribute('translate', 'no');
        // Avoid placeholder/value translation glitches
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.setAttribute('autocapitalize', 'off');
          el.setAttribute('autocomplete', el.getAttribute('autocomplete') ?? 'off');
          el.setAttribute('spellcheck', 'false');
        }
      });
    };

    applyNoTranslateToInputs();

    // MutationObserver: guard against Chrome translate toggling classes or injecting wrappers
    const observer = new MutationObserver((mutations) => {
      let reapply = false;
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target === html && m.attributeName === 'class') {
          // Remove Chrome translate flags
          html.classList.remove('translated-ltr', 'translated-rtl');
        }
        if (m.type === 'childList') {
          // New nodes may include inputs or wrappers; mark them notranslate
          m.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              node.classList.remove('translated-ltr', 'translated-rtl');
              node.setAttribute('translate', 'no');
              applyNoTranslateToInputs(node);
              reapply = true;
            }
          });
        }
      }
      if (reapply) {
        // Re-assert global flags periodically
        html.setAttribute('translate', 'no');
        html.classList.add('notranslate');
        body?.classList.add('notranslate');
        root?.classList.add('notranslate');
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  } catch (e) {
    // Fail-safe: never block app rendering
    console.warn('disableAutoTranslate init warning:', e);
  }
}
