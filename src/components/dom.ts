export type Child = Node | string | number | null | undefined | false;

type Events = {
  onClick?: (event: MouseEvent) => void;
  onChange?: (event: Event) => void;
  onInput?: (event: Event) => void;
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
  title?: string;
  role?: string;
  type?: string;
  value?: string;
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
  if (attrs.title) node.title = attrs.title;
  if (attrs.role) node.setAttribute('role', attrs.role);
  if (attrs.type && 'type' in node) (node as HTMLButtonElement | HTMLInputElement).type = attrs.type;
  if (attrs.value !== undefined && 'value' in node) (node as HTMLInputElement | HTMLOptionElement).value = attrs.value;
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

export function clearAndAppend(parent: HTMLElement, child: Node): void {
  const scrollPositions = new Map<string, { left: number; top: number }>();
  const openDisclosures = new Set<string>();

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

  parent.replaceChildren(child);

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
