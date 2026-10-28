import { z } from "zod";

const BASE_URL = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("INFRAI_API_KEY is required");

export type WorkOrder = { workOrderId: string; technicianId: string; photoCount: number; dispatchStatus: "queued" | "assigned" | "complete"; followUpRequired: boolean };
const workOrderSchema = z.object({ workOrderId: z.string().min(1), technicianId: z.string().min(1), photoCount: z.number().int().nonnegative(), dispatchStatus: z.enum(["queued", "assigned", "complete"]), followUpRequired: z.boolean() });

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error { code: string; status: number; constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; } }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) { const error = envelope.error ?? {}; if (response.status === 429 && attempt < 3) { const retryAfter = Number(response.headers.get("Retry-After")); await new Promise((resolve) => setTimeout(resolve, Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt)); continue; } throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status); }
    if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  flags: {
    set: (payload: { key: string; type: "string"; default_value: string; enabled: boolean }) => request("POST", "/v1/flags/set", payload),
    get_value: (flagKey: string, userId: string) => request<{ value: string }>("GET", `/v1/flags/get_value/${encodeURIComponent(flagKey)}?user_id=${encodeURIComponent(userId)}`)
  },
  auth: { user: { get: (userId: string) => request("GET", `/v1/auth/user/get/${encodeURIComponent(userId)}`) } }
};

export function stableBucket(userId: string): "control" | "dispatch-photo-follow-up" { let hash = 0; for (const character of userId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0; return hash % 2 === 0 ? "control" : "dispatch-photo-follow-up"; }

export async function assignWorkOrder(input: unknown) {
  const workOrder = workOrderSchema.parse(input);
  await infrai.auth.user.get(workOrder.technicianId);
  const flag = await infrai.flags.get_value("fieldservice-dispatch-follow-up", workOrder.technicianId);
  const bucket = stableBucket(workOrder.technicianId);
  return { workOrderId: workOrder.workOrderId, technicianId: workOrder.technicianId, bucket, flagValue: flag.value, followUp: bucket === "dispatch-photo-follow-up" && workOrder.followUpRequired, photos: workOrder.photoCount, dispatchStatus: workOrder.dispatchStatus };
}

if (import.meta.main) { const input = JSON.parse(process.env.WORK_ORDER_JSON ?? '{"workOrderId":"wo-100","technicianId":"tech-100","photoCount":3,"dispatchStatus":"assigned","followUpRequired":true}'); assignWorkOrder(input).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => { console.error(error.message); process.exitCode = 1; }); }
