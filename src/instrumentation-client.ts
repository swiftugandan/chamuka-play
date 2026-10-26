import { initBotId } from "botid/client/core";

// Runs in the browser before the app is interactive. Attaches BotID's signed
// challenge headers to calls to the paid endpoint; /api/agent verifies them with
// checkBotId(). Keep this list in step with the routes that call checkBotId.
initBotId({
  protect: [{ path: "/api/agent", method: "POST" }],
});
