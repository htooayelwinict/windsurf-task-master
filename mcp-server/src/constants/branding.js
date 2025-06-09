/**
 * Windsurf Task Master™ - Branding Constants
 * Copyright (c) 2025 Htoo Aye Lwin
 * 
 * This file is part of Windsurf Task Master™, an open-source project
 * licensed under the MIT License with trademark provisions.
 */

export const BRANDING = {
  // Core Brand Identity
  PRODUCT_NAME: 'Windsurf Task Master™',
  PRODUCT_NAME_SHORT: 'WTM™',
  TAGLINE: 'Project-aware task management for Windsurf developers',
  
  // Legal
  COPYRIGHT: '© 2025 Htoo Aye Lwin. All rights reserved.',
  TRADEMARK_NOTICE: 'Windsurf Task Master™ is a trademark of Htoo Aye Lwin',
  LICENSE: 'MIT License with Trademark Provisions',
  
  // Version Info
  VERSION_PREFIX: 'WTM™',
  
  // CLI/Console Output
  CLI_BANNER: `
╔═══════════════════════════════════════════════════════════════╗
║                    Windsurf Task Master™                      ║
║           Project-aware task management for Windsurf          ║
║                                                               ║
║        © 2025 Htoo Aye Lwin. All rights reserved.             ║
╚═══════════════════════════════════════════════════════════════╝
  `,
  
  // ASCII Art (optional)
  ASCII_LOGO: `
  ██╗    ██╗████████╗███╗   ███╗
  ██║    ██║╚══██╔══╝████╗ ████║
  ██║ █╗ ██║   ██║   ██╔████╔██║
  ██║███╗██║   ██║   ██║╚██╔╝██║
  ╚███╔███╔╝   ██║   ██║ ╚═╝ ██║
   ╚══╝╚══╝    ╚═╝   ╚═╝     ╚═╝
  `,
  
  // Colors (for CLI output)
  COLORS: {
    PRIMARY: '\x1b[36m',    // Cyan
    SECONDARY: '\x1b[35m',  // Magenta  
    SUCCESS: '\x1b[32m',    // Green
    WARNING: '\x1b[33m',    // Yellow
    ERROR: '\x1b[31m',      // Red
    RESET: '\x1b[0m'        // Reset
  },
  
  // URLs
  URLS: {
    GITHUB: 'https://github.com/htooayelwinict/windsurf-task-master',
    DOCS: 'https://github.com/htooayelwinict/windsurf-task-master/blob/main/README.md',
    SUPPORT: 'https://t.me/htooayelwin',
    FACEBOOK: 'https://www.facebook.com/htooayelwin',
    LICENSE: 'https://github.com/htooayelwinict/windsurf-task-master/blob/main/LICENSE'
  },
  
  // Open Source Information
  OPEN_SOURCE: {
    IS_OPEN_SOURCE: true,
    LICENSE_TYPE: 'MIT with Trademark Provisions',
    CONTRIBUTION_GUIDELINES: 'See CONTRIBUTING.md in the repository'
  }
};

// Helper Functions
export const formatBrandedMessage = (message, type = 'info') => {
  const color = BRANDING.COLORS[type.toUpperCase()] || BRANDING.COLORS.RESET;
  return `${color}[${BRANDING.PRODUCT_NAME_SHORT}]${BRANDING.COLORS.RESET} ${message}`;
};

export const getBrandedVersion = (version) => {
  return `${BRANDING.VERSION_PREFIX} v${version}`;
};
