// server/src/routes/rolesProfile.js
import express from 'express';
import authenticate from '../middleware/auth.js';
import { getMyRoleProfile } from '../controllers/roleProfileController.js';

const router = express.Router();

router.get('/me', authenticate, getMyRoleProfile);

export default router;
