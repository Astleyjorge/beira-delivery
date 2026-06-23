import "./db/connection"; // ensures the DB connection (and foreign_keys pragma) is initialized on boot
import { app } from "./app";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(PORT, () => {
  console.log(`🚀 Beira Delivery API running at http://localhost:${PORT}`);
});
