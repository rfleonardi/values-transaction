import express from 'express';
import { registerUser, loginUser, updateUser, getUser, resetPassword } from '../controllers/UserController.js';

const router = express.Router();

router.post('/api/register', registerUser);
router.post('/api/login', loginUser);
router.post('/api/user/update/:im', updateUser);
router.get('/api/user/:userIm', getUser);
router.post('/api/user/reset-password', resetPassword);

export default router;
