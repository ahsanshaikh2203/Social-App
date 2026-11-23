import { buildServer } from "./server.js";

const app = await buildServer({ listen: false });

export default app;
