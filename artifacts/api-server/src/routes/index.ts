import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import rolesRouter from "./roles";
import dashboardRouter from "./dashboard";
import storeSettingsRouter from "./store-settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(rolesRouter);
router.use(dashboardRouter);
router.use(storeSettingsRouter);

export default router;
