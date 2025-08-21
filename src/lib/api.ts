import { supabase } from "./supabase"; // adjust path if already imported

export async function testMonitor(monitor: any) {
  const { data, error } = await supabase.functions.invoke("test-url", {
    body: {
      url: monitor.url,
      monitorId: monitor.id,
      forceAlert: true,
    },
  });

  if (error) {
    console.error("❌ Error testing monitor:", error);
    throw error;
  }

  return data;
}
