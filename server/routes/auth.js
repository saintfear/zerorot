const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

function mapAuthError(error) {
  const message = (error && error.message) ? String(error.message) : '';
  const code = error && error.code ? String(error.code) : '';

  // Prisma: missing tables / db not initialized (common on fresh localhost)
  // - P2021: table does not exist
  // SQLite can also surface "no such table: User" depending on engine.
  if (
    code === 'P2021' ||
    message.toLowerCase().includes('no such table') ||
    (message.toLowerCase().includes('does not exist') && message.toLowerCase().includes('table'))
  ) {
    return {
      status: 503,
      body: {
        error:
          'Database is not initialized. In the zerorot folder run: npx prisma db push (or npx prisma migrate dev), then restart the server.'
      }
    };
  }

  // JWT secret missing
  if (message.toLowerCase().includes('secret or private key must have a value')) {
    return {
      status: 500,
      body: { error: 'Server misconfigured: JWT_SECRET is not set.' }
    };
  }

  // Default: keep generic message (don’t leak internals)
  return { status: 500, body: { error: 'Internal server error' } };
}

// Sign up
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        preferences: JSON.stringify({}) // Store as JSON string for SQLite
      }
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    const mapped = mapAuthError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    const mapped = mapAuthError(error);
    res.status(mapped.status).json(mapped.body);
  }
});

module.exports = router;
