import express from 'express';
import { body, validationResult } from 'express-validator';
import { signIn, signOut, refreshToken, checkAuth } from '../controllers/authController.js';

const router = express.Router();

// Validation middleware
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
];

// Sign in
router.post('/signin', validateLogin, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  signIn(req, res);
});

// Sign out
router.post('/signout', signOut);

// Refresh token
router.post('/refresh', refreshToken);

// Check auth status
router.get('/check', checkAuth);

export default router;
