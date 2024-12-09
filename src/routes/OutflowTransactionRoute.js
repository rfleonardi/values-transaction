import express from "express";
import { getAllOutflows, getOutflowsPerNature, upsertAccountantOutflow, upsertManagerOutflow } from "../controllers/OutflowTransactionController.js";

const router = express.Router();

router.post('/api/transaction/outflow', getOutflowsPerNature);
router.post('/api/transaction/all/outflow', getAllOutflows);
router.post('/api/transaction/accountant/outflow/:ticketId', upsertAccountantOutflow);
router.post('/api/transaction/manager/outflow/:ticketId', upsertManagerOutflow);

export default router;