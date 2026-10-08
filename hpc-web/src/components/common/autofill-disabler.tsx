"use client";

import * as React from "react";

/**
 * Global Autofill & Browser Suggestion Disabler
 *
 * Enforces strict suppression of browser history suggestions, new suggestions,
 * and profile/password autofill across all inputs, textareas, and forms on the website.
 */
export function AutofillDisabler() {
  React.useEffect(() => {
    // 1. Function to sanitize an element against browser autofill/history suggestions
    const sanitizeElement = (el: Element) => {
      if (el instanceof HTMLFormElement) {
        if (el.getAttribute("autocomplete") !== "off") el.setAttribute("autocomplete", "off");
        if (el.getAttribute("autocorrect") !== "off") el.setAttribute("autocorrect", "off");
        if (el.getAttribute("autocapitalize") !== "off") el.setAttribute("autocapitalize", "off");
        if (el.getAttribute("spellcheck") !== "false") el.setAttribute("spellcheck", "false");
        el.setAttribute("data-lpignore", "true");
        el.setAttribute("data-1p-ignore", "true");
        el.setAttribute("data-bwignore", "true");
        el.setAttribute("data-form-type", "other");
      } else if (el instanceof HTMLInputElement) {
        const type = el.type ? el.type.toLowerCase() : "text";
        if (
          type !== "checkbox" &&
          type !== "radio" &&
          type !== "button" &&
          type !== "submit" &&
          type !== "reset" &&
          type !== "hidden"
        ) {
          const autoVal = type === "password" ? "new-password" : "off";
          if (el.getAttribute("autocomplete") !== autoVal) {
            el.setAttribute("autocomplete", autoVal);
          }
          if (el.getAttribute("autocorrect") !== "off") el.setAttribute("autocorrect", "off");
          if (el.getAttribute("autocapitalize") !== "off") el.setAttribute("autocapitalize", "off");
          if (el.getAttribute("spellcheck") !== "false") el.setAttribute("spellcheck", "false");
          el.setAttribute("data-lpignore", "true");
          el.setAttribute("data-1p-ignore", "true");
          el.setAttribute("data-bwignore", "true");
          el.setAttribute("data-form-type", "other");
          el.setAttribute("aria-autocomplete", "none");
        }
      } else if (el instanceof HTMLTextAreaElement) {
        if (el.getAttribute("autocomplete") !== "off") el.setAttribute("autocomplete", "off");
        if (el.getAttribute("autocorrect") !== "off") el.setAttribute("autocorrect", "off");
        if (el.getAttribute("autocapitalize") !== "off") el.setAttribute("autocapitalize", "off");
        if (el.getAttribute("spellcheck") !== "false") el.setAttribute("spellcheck", "false");
        el.setAttribute("data-lpignore", "true");
        el.setAttribute("data-1p-ignore", "true");
        el.setAttribute("data-bwignore", "true");
        el.setAttribute("data-form-type", "other");
        el.setAttribute("aria-autocomplete", "none");
      }
    };

    // 2. Scan entire document tree
    const scanAll = (root: ParentNode = document) => {
      const forms = root.querySelectorAll("form");
      forms.forEach(sanitizeElement);

      const inputs = root.querySelectorAll("input, textarea");
      inputs.forEach(sanitizeElement);
    };

    scanAll(document);

    // 3. MutationObserver for dynamically mounted dialogs, sheets, popovers, and route changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement) {
            sanitizeElement(node);
            scanAll(node);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 4. Capture focusin, pointerdown, touchstart to enforce anti-autofill before browser opens dropdown
    const handleFocusOrPointer = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        const type = (target as HTMLInputElement).type ? (target as HTMLInputElement).type.toLowerCase() : "text";
        if (
          type !== "checkbox" &&
          type !== "radio" &&
          type !== "button" &&
          type !== "submit" &&
          type !== "reset" &&
          type !== "hidden"
        ) {
          const autoVal = type === "password" ? "new-password" : "off";
          if (target.getAttribute("autocomplete") !== autoVal) {
            target.setAttribute("autocomplete", autoVal);
          }
          target.setAttribute("aria-autocomplete", "none");
          target.setAttribute("data-lpignore", "true");
          target.setAttribute("data-1p-ignore", "true");
          target.setAttribute("data-bwignore", "true");
          target.setAttribute("data-form-type", "other");
        }
      }
    };

    window.addEventListener("focusin", handleFocusOrPointer, true);
    window.addEventListener("pointerdown", handleFocusOrPointer, true);
    window.addEventListener("touchstart", handleFocusOrPointer, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("focusin", handleFocusOrPointer, true);
      window.removeEventListener("pointerdown", handleFocusOrPointer, true);
      window.removeEventListener("touchstart", handleFocusOrPointer, true);
    };
  }, []);

  return null;
}
