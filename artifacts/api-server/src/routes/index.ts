import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import imagekitRouter from "./imagekit";
import geocodeRouter from "./geocode";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/imagekit", imagekitRouter);
router.use("/geocode", geocodeRouter);

export default router;
