import { Router, type IRouter } from "express";
import {
  SearchPlacesQueryParams,
  SearchPlacesResponse,
} from "@workspace/api-zod";
import { searchPlaces } from "../lib/nominatim";

const router: IRouter = Router();

router.get("/places", async (req, res): Promise<void> => {
  const parsed = SearchPlacesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  try {
    const places = await searchPlaces(parsed.data.q);
    res.json(SearchPlacesResponse.parse(places));
  } catch (err) {
    req.log.warn({ err }, "place search failed");
    // Degrade gracefully: an autocomplete that errors should return no
    // suggestions rather than break the typing experience.
    res.json([]);
  }
});

export default router;
