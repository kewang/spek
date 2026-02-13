import express from "express";
import cors from "cors";
import { filesystemRouter } from "./routes/filesystem.js";
import { openspecRouter } from "./routes/openspec.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use("/api/fs", filesystemRouter);
app.use("/api/openspec", openspecRouter);

app.listen(PORT, () => {
  console.log(`[spek] API server running on http://localhost:${PORT}`);
});
