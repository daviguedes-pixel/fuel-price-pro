import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '../config/supabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-this-in-production';

// Helper function to generate tokens
function generateTokens(userId: string, email: string) {
  const accessToken = jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, email },
    JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
}

export async function signIn(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Get user data from your auth_users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('auth_users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(authData.user.id, email);

    // Set HTTP-only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userData.role,
        name: userData.name,
      },
      accessToken,
    });
  } catch (error: any) {
    console.error('Sign in error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function signOut(req: Request, res: Response) {
  try {
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({ message: 'Signed out successfully' });
  } catch (error: any) {
    console.error('Sign out error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not provided' });
    }

    try {
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string; email: string };

      // Generate new access token
      const accessToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000,
      });

      res.json({ accessToken });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function checkAuth(req: Request, res: Response) {
  try {
    const accessToken = req.cookies.accessToken || req.headers.authorization?.split(' ')[1];

    if (!accessToken) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    try {
      const decoded = jwt.verify(accessToken, JWT_SECRET) as { userId: string; email: string };

      // Get user data
      const { data: userData, error } = await supabaseAdmin
        .from('auth_users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (error || !userData) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({
        user: {
          id: userData.id,
          email: userData.email,
          role: userData.role,
          name: userData.name,
        },
      });
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  } catch (error: any) {
    console.error('Check auth error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
