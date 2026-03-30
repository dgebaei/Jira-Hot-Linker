const MIRROR_STYLE_PROPERTIES = [
  'borderBottomStyle',
  'borderBottomWidth',
  'borderLeftStyle',
  'borderLeftWidth',
  'borderRightStyle',
  'borderRightWidth',
  'borderTopStyle',
  'borderTopWidth',
  'boxSizing',
  'direction',
  'fontFamily',
  'fontFeatureSettings',
  'fontKerning',
  'fontSize',
  'fontStretch',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'letterSpacing',
  'lineHeight',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'tabSize',
  'textAlign',
  'textIndent',
  'textRendering',
  'textTransform',
  'whiteSpace',
  'wordBreak',
  'wordSpacing',
  'wordWrap',
];

function getSafeCaretIndex(inputElement, caretIndex) {
  const valueLength = String(inputElement?.value || '').length;
  const normalizedIndex = Number.isFinite(Number(caretIndex)) ? Number(caretIndex) : valueLength;
  return Math.max(0, Math.min(valueLength, normalizedIndex));
}

function getLineHeight(computedStyle) {
  const parsedLineHeight = Number.parseFloat(computedStyle.lineHeight);
  if (Number.isFinite(parsedLineHeight)) {
    return parsedLineHeight;
  }
  const parsedFontSize = Number.parseFloat(computedStyle.fontSize);
  return Number.isFinite(parsedFontSize) ? parsedFontSize * 1.4 : 18;
}

function getTextInputCaretClientPosition(inputElement, caretIndex) {
  if (!inputElement || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  const safeCaretIndex = getSafeCaretIndex(inputElement, caretIndex);
  const value = String(inputElement.value || '');
  const inputRect = inputElement.getBoundingClientRect();
  const computedStyle = window.getComputedStyle(inputElement);
  const mirror = document.createElement('div');

  MIRROR_STYLE_PROPERTIES.forEach(propertyName => {
    mirror.style[propertyName] = computedStyle[propertyName];
  });

  mirror.style.height = `${inputRect.height}px`;
  mirror.style.left = `${inputRect.left}px`;
  mirror.style.overflow = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.position = 'fixed';
  mirror.style.top = `${inputRect.top}px`;
  mirror.style.visibility = 'hidden';
  mirror.style.width = `${inputRect.width}px`;
  mirror.style.overflowWrap = 'break-word';
  mirror.style.whiteSpace = inputElement.tagName.toLowerCase() === 'textarea' ? 'pre-wrap' : 'pre';

  mirror.textContent = value.slice(0, safeCaretIndex);
  if (mirror.textContent.endsWith('\n')) {
    mirror.textContent += '\u200b';
  }

  const marker = document.createElement('span');
  marker.textContent = value.slice(safeCaretIndex) || '\u200b';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const lineHeight = getLineHeight(computedStyle);
  const top = inputRect.top + marker.offsetTop - inputElement.scrollTop;
  const left = inputRect.left + marker.offsetLeft - inputElement.scrollLeft;

  document.body.removeChild(mirror);

  return {
    bottom: top + lineHeight,
    left,
    lineHeight,
    top,
  };
}

export function positionMentionMenuAtCaret({
  caretIndex,
  hostElement,
  inputElement,
  menuElement,
  offsetY = 6,
}) {
  if (!menuElement || !inputElement || !hostElement) {
    return;
  }

  const caretPosition = getTextInputCaretClientPosition(inputElement, caretIndex);
  if (!caretPosition) {
    return;
  }

  const hostRect = hostElement.getBoundingClientRect();
  const availableWidth = Math.max(120, Math.floor(hostRect.width - 8));

  menuElement.style.left = '4px';
  menuElement.style.maxWidth = `${availableWidth}px`;
  menuElement.style.position = 'absolute';
  menuElement.style.top = '4px';

  const menuWidth = Math.min(menuElement.offsetWidth || availableWidth, availableWidth);
  const menuHeight = menuElement.offsetHeight || 0;
  const anchorLeft = caretPosition.left - hostRect.left;
  const belowTop = caretPosition.bottom - hostRect.top + offsetY;
  const aboveTop = caretPosition.top - hostRect.top - menuHeight - offsetY;
  const hasRoomBelow = caretPosition.bottom + menuHeight + offsetY <= window.innerHeight - 8;
  const minLeft = 4;
  const maxLeft = Math.max(minLeft, hostRect.width - menuWidth - 4);
  const resolvedLeft = Math.max(minLeft, Math.min(anchorLeft, maxLeft));
  const resolvedTop = !hasRoomBelow && aboveTop >= 4 ? aboveTop : belowTop;

  menuElement.style.left = `${Math.round(resolvedLeft)}px`;
  menuElement.style.top = `${Math.max(4, Math.round(resolvedTop))}px`;
}
