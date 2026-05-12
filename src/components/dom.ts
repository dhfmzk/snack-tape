export type Child = Node | string | number | null | undefined | false;

type Events = {
  onClick?: (event: MouseEvent) => void;
  onChange?: (event: Event) => void;
  onInput?: (event: Event) => void;
  onError?: (event: Event) => void;
  onKeyDown?: (event: KeyboardEvent) => void;
  onDragStart?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
};

type Attrs = Events & {
  className?: string;
  style?: Partial<CSSStyleDeclaration> | string;
  text?: string;
  htmlFor?: string;
  ariaLabel?: string;
  ariaChecked?: string;
  ariaDisabled?: string;
  ariaExpanded?: string;
  ariaHasPopup?: string;
  ariaPressed?: string;
  ariaValueMax?: string;
  ariaValueMin?: string;
  ariaValueNow?: string;
  ariaValueText?: string;
  title?: string;
  role?: string;
  type?: string;
  src?: string;
  alt?: string;
  loading?: string;
  value?: string;
  placeholder?: string;
  tabIndex?: number;
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean;
  draggable?: boolean;
  dataset?: Record<string, string>;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);

  if (attrs.className) node.className = attrs.className;
  if (typeof attrs.style === 'string') node.style.cssText = attrs.style;
  if (attrs.style && typeof attrs.style !== 'string') Object.assign(node.style, attrs.style);
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.htmlFor) node.setAttribute('for', attrs.htmlFor);
  if (attrs.ariaLabel) node.setAttribute('aria-label', attrs.ariaLabel);
  if (attrs.ariaChecked !== undefined) node.setAttribute('aria-checked', attrs.ariaChecked);
  if (attrs.ariaDisabled !== undefined) node.setAttribute('aria-disabled', attrs.ariaDisabled);
  if (attrs.ariaExpanded !== undefined) node.setAttribute('aria-expanded', attrs.ariaExpanded);
  if (attrs.ariaHasPopup !== undefined) node.setAttribute('aria-haspopup', attrs.ariaHasPopup);
  if (attrs.ariaPressed !== undefined) node.setAttribute('aria-pressed', attrs.ariaPressed);
  if (attrs.ariaValueMax !== undefined) node.setAttribute('aria-valuemax', attrs.ariaValueMax);
  if (attrs.ariaValueMin !== undefined) node.setAttribute('aria-valuemin', attrs.ariaValueMin);
  if (attrs.ariaValueNow !== undefined) node.setAttribute('aria-valuenow', attrs.ariaValueNow);
  if (attrs.ariaValueText !== undefined) node.setAttribute('aria-valuetext', attrs.ariaValueText);
  if (attrs.title) node.title = attrs.title;
  if (attrs.role) node.setAttribute('role', attrs.role);
  if (attrs.type && 'type' in node) (node as HTMLButtonElement | HTMLInputElement).type = attrs.type;
  if (attrs.src && 'src' in node) (node as HTMLImageElement).src = attrs.src;
  if (attrs.alt !== undefined && 'alt' in node) (node as HTMLImageElement).alt = attrs.alt;
  if (attrs.loading) node.setAttribute('loading', attrs.loading);
  if (attrs.value !== undefined && 'value' in node) (node as HTMLInputElement | HTMLOptionElement).value = attrs.value;
  if (attrs.placeholder !== undefined) {
    if ('placeholder' in node) (node as HTMLInputElement).placeholder = attrs.placeholder;
    node.setAttribute('placeholder', attrs.placeholder);
  }
  if (attrs.tabIndex !== undefined) node.setAttribute('tabindex', String(attrs.tabIndex));
  if (attrs.disabled !== undefined && 'disabled' in node) (node as HTMLButtonElement | HTMLInputElement | HTMLSelectElement).disabled = attrs.disabled;
  if (attrs.selected !== undefined && 'selected' in node) (node as HTMLOptionElement).selected = attrs.selected;
  if (attrs.checked !== undefined && 'checked' in node) (node as HTMLInputElement).checked = attrs.checked;
  if (attrs.draggable !== undefined) node.draggable = attrs.draggable;

  if (attrs.dataset) {
    for (const [key, value] of Object.entries(attrs.dataset)) {
      node.dataset[key] = value;
    }
  }

  if (attrs.onClick) node.addEventListener('click', attrs.onClick as EventListener);
  if (attrs.onChange) node.addEventListener('change', attrs.onChange as EventListener);
  if (attrs.onInput) node.addEventListener('input', attrs.onInput as EventListener);
  if (attrs.onError) node.addEventListener('error', attrs.onError as EventListener);
  if (attrs.onKeyDown) node.addEventListener('keydown', attrs.onKeyDown as EventListener);
  if (attrs.onDragStart) node.addEventListener('dragstart', attrs.onDragStart as EventListener);
  if (attrs.onDragOver) node.addEventListener('dragover', attrs.onDragOver as EventListener);
  if (attrs.onDrop) node.addEventListener('drop', attrs.onDrop as EventListener);
  if (attrs.onDragEnd) node.addEventListener('dragend', attrs.onDragEnd as EventListener);

  for (const child of children) {
    if (child === null || child === undefined || child === false) {
      continue;
    }

    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}

type ActiveFormSnapshot = {
  element: HTMLElement;
  persistKey: string;
  tagName: string;
  value?: string;
  checked?: boolean;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  selectionDirection?: 'forward' | 'backward' | 'none' | null;
};

function childElements(node: Node): HTMLElement[] {
  return Array.from((node as ParentNode).children ?? []) as HTMLElement[];
}

function findPersistedElement(root: Node, persistKey: string, tagName: string): HTMLElement | null {
  const element = root as HTMLElement;
  if (
    element.tagName === tagName
    && element.dataset?.persistKey === persistKey
  ) {
    return element;
  }

  for (const child of childElements(root)) {
    const found = findPersistedElement(child, persistKey, tagName);
    if (found) {
      return found;
    }
  }

  return null;
}

function activeFormSnapshot(): ActiveFormSnapshot | null {
  const element = document.activeElement as HTMLElement | null;
  const persistKey = element?.dataset?.persistKey;
  if (!element || !persistKey) {
    return null;
  }

  const tagName = element.tagName;
  if (tagName !== 'INPUT' && tagName !== 'TEXTAREA' && tagName !== 'SELECT') {
    return null;
  }

  const formElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const selectable = formElement as HTMLInputElement | HTMLTextAreaElement;
  return {
    element,
    persistKey,
    tagName,
    value: formElement.value,
    checked: 'checked' in formElement ? formElement.checked : undefined,
    selectionStart: 'selectionStart' in selectable ? selectable.selectionStart : null,
    selectionEnd: 'selectionEnd' in selectable ? selectable.selectionEnd : null,
    selectionDirection: 'selectionDirection' in selectable ? selectable.selectionDirection : null,
  };
}

function preserveActiveSelect(child: Node, snapshot: ActiveFormSnapshot | null): boolean {
  if (!snapshot || snapshot.tagName !== 'SELECT') {
    return false;
  }

  const next = findPersistedElement(child, snapshot.persistKey, snapshot.tagName);
  if (!next) {
    return false;
  }

  next.replaceWith(snapshot.element);
  return true;
}

function restoreActiveInput(child: Node, snapshot: ActiveFormSnapshot | null): void {
  if (!snapshot || snapshot.tagName === 'SELECT') {
    return;
  }

  const next = findPersistedElement(child, snapshot.persistKey, snapshot.tagName) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!next) {
    return;
  }

  if (snapshot.value !== undefined) {
    next.value = snapshot.value;
  }
  if (snapshot.checked !== undefined && 'checked' in next) {
    next.checked = snapshot.checked;
  }

  next.focus({ preventScroll: true });
  if (
    snapshot.selectionStart !== null
    && snapshot.selectionStart !== undefined
    && snapshot.selectionEnd !== null
    && snapshot.selectionEnd !== undefined
    && typeof next.setSelectionRange === 'function'
  ) {
    next.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd, snapshot.selectionDirection ?? 'none');
  }
}

export function clearAndAppend(parent: HTMLElement, child: Node): void {
  const scrollPositions = new Map<string, { left: number; top: number }>();
  const openDisclosures = new Set<string>();
  const activeSnapshot = activeFormSnapshot();

  for (const node of Array.from(parent.querySelectorAll<HTMLElement>('[data-scroll-key]'))) {
    const key = node.dataset.scrollKey;
    if (key) {
      scrollPositions.set(key, { left: node.scrollLeft, top: node.scrollTop });
    }
  }

  for (const node of Array.from(parent.querySelectorAll<HTMLDetailsElement>('details[open][data-disclosure-key]'))) {
    const key = node.dataset.disclosureKey;
    if (key) {
      openDisclosures.add(key);
    }
  }

  const preservedSelect = preserveActiveSelect(child, activeSnapshot);
  parent.replaceChildren(child);
  if (!preservedSelect) {
    restoreActiveInput(child, activeSnapshot);
  }

  for (const node of Array.from(parent.querySelectorAll<HTMLElement>('[data-scroll-key]'))) {
    const key = node.dataset.scrollKey;
    const position = key ? scrollPositions.get(key) : undefined;
    if (position) {
      node.scrollLeft = position.left;
      node.scrollTop = position.top;
    }
  }

  for (const node of Array.from(parent.querySelectorAll<HTMLDetailsElement>('details[data-disclosure-key]'))) {
    const key = node.dataset.disclosureKey;
    if (key && openDisclosures.has(key)) {
      node.open = true;
    }
  }
}
