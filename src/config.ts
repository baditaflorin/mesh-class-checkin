import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-class-checkin",
  description:
    "Fitness class check-in with auto-waitlist when class fills, no account, mesh-synced",
  accentHex: "#22c55e",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
