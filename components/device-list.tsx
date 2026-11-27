"use client";

import { useActionState } from "react";
import { revokeDeviceAction } from "@/lib/actions/session";
import { buttonClass } from "@/components/styles";
import type { FormState } from "@/lib/types";

const initialState: FormState = {};

export type DeviceRow = {
  id: string;
  label: string;
  seen: string;
  current: boolean;
};

function RevokeDeviceForm({ sessionId }: { sessionId: string }) {
  const [state, submit, pending] = useActionState(revokeDeviceAction, initialState);
  return (
    <form action={submit} className="inline">
      <input type="hidden" name="sessionId" value={sessionId} />
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Signing out…" : "Sign out this device"}
      </button>
      {state.error ? (
        <span role="alert" className="ml-2 text-[12px] text-hn-danger">
          {state.error}
        </span>
      ) : null}
      {state.notice ? <span className="ml-2 text-[12px] text-hn-sub">{state.notice}</span> : null}
    </form>
  );
}

export function DeviceList({ devices }: { devices: DeviceRow[] }) {
  return (
    <div data-testid="device-list" className="space-y-2">
      {devices.length === 0 ? <p className="text-[12px] text-hn-sub">No recorded devices.</p> : null}
      <ul className="space-y-1">
        {devices.map((device) => (
          <li key={device.id} data-testid="device-row" data-current={device.current ? "true" : "false"}>
            <span>
              {device.label}
              {device.current ? " (this device)" : ""}
            </span>
            <span className="ml-2 text-hn-sub">seen {device.seen}</span>
            <span className="ml-2">
              <RevokeDeviceForm sessionId={device.id} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
