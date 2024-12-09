import express from "express";
import { getAccountNumber, getAllExercises, getAllJournals } from "../controllers/JournalController.js";

const router = express.Router();

router.get('/api/journal', getAllJournals);
router.post('/api/journal/accountNumber', getAccountNumber);
router.get('/api/journal/exercise', getAllExercises);

export default router;