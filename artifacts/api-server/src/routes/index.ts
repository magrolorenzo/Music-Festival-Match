import { Router, type IRouter } from "express";
import healthRouter from "./health";
import placesRouter from "./places";
import searchRouter from "./search";

const router: IRouter = Router();

router.use(healthRouter);
router.use(placesRouter);
router.use(searchRouter);

export default router;
