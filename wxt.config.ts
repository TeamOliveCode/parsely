import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Parsely',
    description: 'Read articles one paragraph at a time. Focused, distraction-free reading.',
    permissions: ['storage', 'scripting', 'activeTab', 'contextMenus'],
    action: {},
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Alt+R',
          mac: 'MacCtrl+Shift+R'
        },
        description: 'Run Parsely'
      }
    }
  },
});
