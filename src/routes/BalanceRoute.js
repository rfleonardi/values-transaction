import express from "express";
import { getAllTransactionBalances, getAllInProgressTransaction, getBalancesPerNature, getLastExercisesTransactionBalances, getPaymentBalancesPerNatures, getAllPaymentBalances, getLastExercisesPaymentBalances } from "../controllers/BalanceController.js";

const router = express.Router();

router.post('/api/transaction/balance', getBalancesPerNature);
router.post('/api/payment/balance', getPaymentBalancesPerNatures);
router.post('/api/transaction/in-progress', getAllInProgressTransaction);
router.post('/api/transaction/all/balance', getAllTransactionBalances);
router.post('/api/payment/all/balance', getAllPaymentBalances);
router.post('/api/transaction/last-exercises-balance', getLastExercisesTransactionBalances);
router.get('/api/payment/last-exercises-balance', getLastExercisesPaymentBalances);

export default router;