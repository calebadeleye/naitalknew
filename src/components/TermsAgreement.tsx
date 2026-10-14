import React from "react";

/**
 * The "I agree" box shown wherever someone signs up or orders. The links open
 * in a new tab so reading the terms never loses what was typed in the form.
 */
export function TermsAgreement({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 text-left text-xs leading-5 text-white/70 ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#b8f04a]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required
      />
      <span>
        I have read and agree to the{" "}
        <a href="/terms-of-service" target="_blank" rel="noopener" className="font-bold text-primary underline">
          Terms of Service
        </a>
        ,{" "}
        <a href="/privacy-policy" target="_blank" rel="noopener" className="font-bold text-primary underline">
          Privacy Policy
        </a>{" "}
        and{" "}
        <a href="/refund-policy" target="_blank" rel="noopener" className="font-bold text-primary underline">
          Refund Policy
        </a>
        .
      </span>
    </label>
  );
}
