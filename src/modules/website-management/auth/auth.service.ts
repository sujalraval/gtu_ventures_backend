// @ts-nocheck
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../../lib/prisma').default;

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key';

class AuthService {
  async login(email, password) {
    const user = await prisma.webUser.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid email or password');

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) throw new Error('Invalid email or password');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return { token, user: { id: user.id, email: user.email, role: user.role } };
  }

  async getMe(userId) {
    const user = await prisma.webUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true }
    });
    if (!user) throw new Error('User not found');
    return user;
  }
}

export default new AuthService();
