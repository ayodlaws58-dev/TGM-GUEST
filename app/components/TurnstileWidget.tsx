"use client";

import { useEffect, useRef } from "react";

// The site key is public by design. Override per environment with NEXT_PUBLIC_TURNSTILE_SITE_KEY.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAFmqysCEQdxt8qlx";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not initialise.")));
    script.onerror = () => { scriptPromise = null; reject(new Error("Unable to load the security check.")); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

type Props = {
  onToken: (token: string | null) => void;
  onError?: (message: string) => void;
  handleRef?: React.MutableRefObject<TurnstileHandle | null>;
};

export default function TurnstileWidget({ onToken, onError, handleRef }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    loadTurnstile().then((api) => {
      if (cancelled || !container) return;
      widgetId.current = api.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => callbacks.current.onToken(token),
        "expired-callback": () => callbacks.current.onToken(null),
        "timeout-callback": () => callbacks.current.onToken(null),
        "error-callback": () => {
          callbacks.current.onToken(null);
          callbacks.current.onError?.("The security check could not load. Check your connection and try again.");
        },
      });
      if (handleRef) handleRef.current = { reset: () => { callbacks.current.onToken(null); api.reset(widgetId.current); } };
    }).catch((cause: unknown) => {
      if (!cancelled) callbacks.current.onError?.(cause instanceof Error ? cause.message : "Unable to load the security check.");
    });
    return () => {
      cancelled = true;
      if (widgetId.current !== undefined) window.turnstile?.remove(widgetId.current);
      if (handleRef) handleRef.current = null;
    };
  }, [handleRef]);

  return <div ref={containerRef} className="turnstile-slot" />;
}
