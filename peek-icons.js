const PEEK_SVG_ICONS = {
  settings:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.25 4.97L10.39 2.89L13.61 2.89L13.75 4.97L14.77 5.3L15.73 5.79L17.31 4.42L19.58 6.69L18.21 8.27L18.7 9.23L19.03 10.25L21.11 10.39L21.11 13.61L19.03 13.75L18.7 14.77L18.21 15.73L19.58 17.31L17.31 19.58L15.73 18.21L14.77 18.7L13.75 19.03L13.61 21.11L10.39 21.11L10.25 19.03L9.23 18.7L8.27 18.21L6.69 19.58L4.42 17.31L5.79 15.73L5.3 14.77L4.97 13.75L2.89 13.61L2.89 10.39L4.97 10.25L5.3 9.23L5.79 8.27L4.42 6.69L6.69 4.42L8.27 5.79L9.23 5.3Z"/><circle cx="12" cy="12" r="3"/></svg>',
  popup:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="14" height="14" rx="2"/><path d="M17 9h4v10H7"/></svg>',
  external:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  copy:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 11-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  back:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m11 18-6-6 6-6"/></svg>',
  forward:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  pin:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g transform="rotate(35 12 12)"><path class="peek-pin-head" d="M8 3h8v3l-1 1v5l3 3v1H6v-1l3-3V7L8 6Z"/><path d="M12 16v6"/></g></svg>'
};

function peekIconButton(className, iconKey, title, ariaLabel) {
  const icon = PEEK_SVG_ICONS[iconKey] || "";
  return `<button class="${className} peek-icon-btn" type="button" title="${title}" aria-label="${ariaLabel}">${icon}</button>`;
}
