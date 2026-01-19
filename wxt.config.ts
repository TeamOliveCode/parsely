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

    // Base permissions - Safari doesn't support 'scripting' permission well
    const permissions: string[] = ['storage', 'activeTab', 'contextMenus'];
    if (browser !== 'safari') {
      permissions.push('scripting');
    }

    // Safari: avoid <all_urls> to prevent scary permission prompts
    // Use activeTab instead - it grants access only when user clicks the extension
    const hostPermissions = ['https://cloud.umami.is/*', '<all_urls>'];

    return {
      name: 'Parsely',
      description: 'Read articles one paragraph at a time. Focused, distraction-free reading.',
      permissions,
      host_permissions: hostPermissions,
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
      // Browser-specific settings
      ...(browser === 'firefox' && {
        browser_specific_settings: {
          gecko: {
            id: 'parsely@olivecode.dev',
            strict_min_version: '128.0',
            data_collection_permissions: {
              required: ['none'],
            },
          },
        },
      }),
    };
  },
});
