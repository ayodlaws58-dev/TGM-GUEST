"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

type Props = {
  hosts: string[];
  /** Name of the hidden input that carries the chosen host in the surrounding form. */
  name: string;
  label: string;
  placeholder?: string;
};

// A searchable replacement for a <select>: type any part of a name to filter, then pick from the list.
// Only a name that exists in `hosts` is submitted, so visitors can't enter someone who isn't in the directory.
export default function HostSearch({ hosts, name, label, placeholder = "Search for an employee" }: Props) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    // Show the whole directory when nothing is typed or a name has just been chosen.
    if (!normalized || normalized === selected.toLowerCase()) return hosts;
    const tokens = normalized.split(/\s+/);
    return hosts
      .filter((host) => {
        const lower = host.toLowerCase();
        return tokens.every((token) => lower.includes(token));
      })
      .sort((first, second) => Number(second.toLowerCase().startsWith(normalized)) - Number(first.toLowerCase().startsWith(normalized)));
  }, [hosts, query, selected]);

  // Let the browser's own required-field validation block submitting free text that isn't a real employee.
  useEffect(() => {
    inputRef.current?.setCustomValidity(selected ? "" : "Choose an employee from the list.");
  }, [selected]);

  function choose(host: string) {
    setSelected(host);
    setQuery(host);
    setOpen(false);
  }

  function handleChange(value: string) {
    setQuery(value);
    setOpen(true);
    setActive(0);
    const exact = hosts.find((host) => host.toLowerCase() === value.trim().toLowerCase());
    setSelected(exact ?? "");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      else setActive((index) => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open) {
      // Pick the highlighted name instead of submitting the form.
      event.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const activeId = open && matches[active] ? `${id}-option-${active}` : undefined;

  return (
    <div className="host-field">
      <label htmlFor={id}>{label}</label>
      <div className="host-combo">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          placeholder={placeholder}
          maxLength={120}
          required
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
        />
        <input type="hidden" name={name} value={selected} />
        {open && (
          <ul id={listId} className="host-list" role="listbox" aria-label={label}>
            {matches.map((host, index) => (
              <li
                key={host}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={host === selected}
                data-active={index === active}
                // mousedown (not click) so the input keeps focus and onBlur doesn't close the list first
                onMouseDown={(event) => { event.preventDefault(); choose(host); }}
                onMouseEnter={() => setActive(index)}
              >
                {host}
              </li>
            ))}
            {matches.length === 0 && <li className="host-empty" role="presentation">No employee matches &ldquo;{query.trim()}&rdquo;. Check the spelling or ask reception.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
