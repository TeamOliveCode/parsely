import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  zip: {
    excludeSources: [
      '.output/**',
      'coverage/**',
      '.vscode/**',
      '.idea/**',
      '.env',
      '.env.*',
      '!.env.example',
      '.git/**',
      '.github/**',
      '.claude/**',
      '.docs/**',
      'ini/**',
    ],
  },
  manifest: ({ browser, manifestVersion }) => {
    // Firefox MV2 uses _execute_browser_action, Chrome MV3 uses _execute_action
    const commandKey =
      browser === 'firefox' && manifestVersion === 2
        ? '_execute_browser_action'
        : '_execute_action';

    return {
      name: 'Parsely',
      description: 'Read articles one paragraph at a time. Focused, distraction-free reading.',
      permissions: ['storage', 'scripting', 'activeTab', 'contextMenus'],
      host_permissions: ['https://cloud.umami.is/*'],
      action: {},
      commands: {
        [commandKey]: {
          suggested_key: {
            default: 'Alt+R',
            mac: 'MacCtrl+Shift+R',
          },
          description: 'Run Parsely',
        },
      },
      browser_specific_settings: {
        gecko: {
          id: 'parsely@olivecode.dev',
          strict_min_version: '128.0',
          data_collection_permissions: {
            required: ['none'],
          },
        },
      },
    };
  },
});
