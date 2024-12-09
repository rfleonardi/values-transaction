import express from "express";
import { deleteTransaction, getAllInflows, getInflowsPerNature, upsertAccountantInflow, upsertManagerInflow, validateOrderNumber } from "../controllers/InflowTransactionController.js";

const router = express.Router();

router.post('/api/transaction/inflow', getInflowsPerNature);
router.post('/api/transaction/all/inflow', getAllInflows);
router.post('/api/transaction/validation/order-number/:ticketId', validateOrderNumber);
router.post('/api/transaction/accountant/inflow/:ticketId', upsertAccountantInflow);
router.post('/api/transaction/manager/inflow/:ticketId', upsertManagerInflow);
router.post('/api/transaction/delete/:ticketId', deleteTransaction);

export default router;
