import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import imagekitRouter from "./imagekit";
import formUploadRouter from "./formUpload";
import geocodeRouter from "./geocode";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/imagekit", imagekitRouter);
router.use("/form-upload", formUploadRouter);
router.use("/geocode", geocodeRouter);
router.use("/auth", authRouter);

export default router;
