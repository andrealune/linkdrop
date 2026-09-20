import { createApp } from "./app.js";
import { env } from "./env.js";

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Linkdrop server listening on port ${env.PORT}`);
});
