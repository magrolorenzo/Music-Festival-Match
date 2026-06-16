import { Router, type IRouter } from "express";
import { SearchEventsBody, SearchEventsResponse } from "@workspace/api-zod";
import { runSearch } from "../lib/search";

const router: IRouter = Router();

router.post("/search", async (req, res): Promise<void> => {
  const parsed = SearchEventsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await runSearch(parsed.data);
  res.json(SearchEventsResponse.parse(result));
});

export default router;
