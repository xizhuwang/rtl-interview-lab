const defaultClientId = 'ca-pub-1191948823193656';
const clientId = (import.meta.env.VITE_ADSENSE_CLIENT_ID || defaultClientId).trim();
const footerSlotId = (import.meta.env.VITE_ADSENSE_FOOTER_SLOT_ID ?? '').trim();

const validClientId = /^ca-pub-\d+$/.test(clientId);
const validSlotId = /^\d+$/.test(footerSlotId);

export const adsenseConfig = {
  enabled: import.meta.env.PROD && validClientId && validSlotId,
  clientId,
  footerSlotId,
  allowedHosts: new Set(['xizhuwang.github.io']),
} as const;
