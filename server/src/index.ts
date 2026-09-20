import { createApp } from "./app.js";
import { assertAdminTokenPresent, env } from "./env.js";

// Exit before binding to a port if required configuration is missing.
assertAdminTokenPresent();

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Linkdrop server listening on port ${env.PORT}`);
});
