import { Router, type IRouter } from "express";
import healthRouter from "./health";
import registerRouter from "./register";
import academicRouter from "./academic";
import managementRouter, { publicSchoolRouter } from "./management";
import { identifySchoolAccount } from "../middlewares/schoolAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicSchoolRouter);
router.use(identifySchoolAccount);
router.use(registerRouter);
router.use(academicRouter);
router.use(managementRouter);

export default router;
