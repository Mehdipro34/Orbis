const fallbackSupabaseUrl = "https://wdwvcvpgovvkoodozbxf.supabase.co";
const fallbackPublishableKey = "sb_publishable_B-88igN5GVsuj67o-vtCVA_--RFWsLx";

export const supabaseUrl = (
  process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackSupabaseUrl
).replace(/\/+$/, "");
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || fallbackPublishableKey;
export const orbisEdgeFunctionUrl = supabaseUrl + "/functions/v1/orbis-api";
export const currentProductionUrl = "https://orbis-mehdipro34.vercel.app";
