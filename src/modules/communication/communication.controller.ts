// @ts-nocheck
import { Request, Response } from 'express';
import { sseManager } from '../../lib/sseManager';
import prisma from '../../lib/prisma';

export const getThreads = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const participations = await prisma.threadParticipant.findMany({
      where: { userId },
      include: {
        MessageThread: {
          include: {
            ThreadParticipant: {
              include: {
                User: { select: { id: true, name: true, email: true, role: true } }
              }
            },
            Message: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, content: true, senderId: true, createdAt: true }
            }
          }
        }
      },
      orderBy: { MessageThread: { updatedAt: 'desc' } }
    });

    const threads = participations.map((p: any) => ({
      id: p.MessageThread.id,
      subject: p.MessageThread.subject,
      contextType: p.MessageThread.contextType,
      updatedAt: p.MessageThread.updatedAt,
      hasUnread: p.hasUnread,
      otherParticipants: p.MessageThread.ThreadParticipant
        .filter((op: any) => op.userId !== userId)
        .map((op: any) => op.User),
      lastMessage: p.MessageThread.Message[0] || null,
    }));

    res.json({ success: true, data: threads });
  } catch (error: any) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch threads' });
  }
};

export const createNewThread = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { subject, recipientId, initialMessage, contextType } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!recipientId || !initialMessage) {
      return res.status(400).json({ success: false, message: 'Recipient and initial message are required' });
    }

    // Wrap in transaction to ensure all parts are created
    const thread = await prisma.$transaction(async (tx) => {
      // 1. Create Thread
      const newThread = await tx.messageThread.create({
        data: {
          subject,
          contextType,
          updatedAt: new Date(),
          ThreadParticipant: {
            create: [
              { userId, role: 'CREATOR' },
              { userId: recipientId, role: 'MEMBER', hasUnread: true }
            ]
          }
        }
      });

      // 2. Create Initial Message
      const message = await tx.message.create({
        data: {
          threadId: newThread.id,
          senderId: userId,
          content: initialMessage,
          updatedAt: new Date()
        }
      });

      // 3. Update Thread updatedAt
      await tx.messageThread.update({
        where: { id: newThread.id },
        data: { updatedAt: new Date() }
      });

      return newThread;
    });

    res.status(201).json({ success: true, data: thread, message: 'Thread created successfully' });
  } catch (error: any) {
    console.error('Error creating thread:', error);
    res.status(500).json({ success: false, message: 'Failed to create thread' });
  }
};

export const getMessages = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { threadId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Verify user is part of the thread
    const participation = await (prisma.threadParticipant as any).findFirst({
      where: { threadId, userId }
    });

    if (!participation) {
      return res.status(403).json({ success: false, message: 'You do not have access to this thread' });
    }

    // If there were unread messages, mark them as read
    if (participation.hasUnread) {
      await (prisma.threadParticipant as any).update({
        where: { id: participation.id },
        data: { hasUnread: false }
      });
    }

    const rawMessages = await prisma.message.findMany({
      where: { threadId },
      include: {
        User: { select: { id: true, name: true, role: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Normalise shape: frontend expects msg.senderId and msg.sender
    const messages = rawMessages.map((m: any) => ({
      id: m.id,
      threadId: m.threadId,
      senderId: m.senderId,
      content: m.content,
      createdAt: m.createdAt,
      sender: m.User,
    }));

    res.json({ success: true, data: messages });
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { threadId } = req.params;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    // Verify user is part of the thread
    const participation = await (prisma.threadParticipant as any).findUnique({
      where: { threadId_userId: { threadId, userId } }
    });

    if (!participation) {
      return res.status(403).json({ success: false, message: 'You do not have access to this thread' });
    }

    // Create message and update thread
    const result = await prisma.$transaction(async (tx) => {
      const raw = await tx.message.create({
        data: { threadId, senderId: userId, content, updatedAt: new Date() },
        include: { User: { select: { id: true, name: true, role: true } } }
      });
      const message = { id: raw.id, threadId: raw.threadId, senderId: raw.senderId, content: raw.content, createdAt: raw.createdAt, sender: (raw as any).User };

      // Mark unread for all OTHER participants
      await tx.threadParticipant.updateMany({
        where: {
          threadId,
          userId: { not: userId }
        },
        data: { hasUnread: true }
      });

      await tx.messageThread.update({
        where: { id: threadId },
        data: { updatedAt: new Date() }
      });

      return message;
    });

    // Notify all other thread participants via SSE
    const participants = await (prisma.threadParticipant as any).findMany({
      where: { threadId, userId: { not: userId } },
      select: { userId: true }
    });
    const senderName = result.sender?.name || 'Someone';
    for (const p of participants) {
      sseManager.send(p.userId, 'notification', {
        type: 'message',
        title: `New message from ${senderName}`,
        description: content.length > 80 ? content.slice(0, 80) + '…' : content,
        link: '/staff/communication',
      });
    }

    res.status(201).json({ success: true, data: result, message: 'Message sent' });
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

export const getApplicationThread = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { applicationId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // 1. Find if thread exists
    let thread = await (prisma.messageThread as any).findFirst({
      where: {
        applicationId,
        contextType: 'APPLICATION_REVIEW'
      }
    });

    // 2. If it doesn't exist, create it
    if (!thread) {
      const app = await prisma.startupApplication.findUnique({ where: { id: applicationId } });
      if (!app) {
        return res.status(404).json({ success: false, message: 'Application not found' });
      }

      thread = await (prisma.messageThread as any).create({
        data: {
          subject: app.startupName,
          contextType: 'APPLICATION_REVIEW',
          applicationId,
          updatedAt: new Date()
        }
      });
    }

    // 3. Ensure the current user is a participant
    const participation = await (prisma.threadParticipant as any).findFirst({
      where: { threadId: thread.id, userId }
    });

    if (!participation) {
      await (prisma.threadParticipant as any).create({
        data: {
          threadId: thread.id,
          userId,
          role: 'MEMBER'
        }
      });
    }

    res.json({ success: true, data: thread });
  } catch (error: any) {
    console.error('Error fetching application thread:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch application thread' });
  }
};

// GET /communication/unread-messages
// Returns threads where the caller has hasUnread = true (for notification bell)
export const getUnreadMessages = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const unread = await prisma.threadParticipant.findMany({
      where: { userId, hasUnread: true },
      include: {
        MessageThread: {
          include: {
            ThreadParticipant: {
              include: { User: { select: { id: true, name: true, email: true, role: true } } }
            },
            Message: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true, content: true, senderId: true, createdAt: true }
            }
          }
        }
      },
      orderBy: { MessageThread: { updatedAt: 'desc' } }
    });

    const threads = unread.map((p: any) => {
      const others = p.MessageThread.ThreadParticipant
        .filter((op: any) => op.userId !== userId)
        .map((op: any) => op.User);
      const senderName = others[0]?.name || others[0]?.email?.split('@')[0] || 'Someone';
      const lastMsg = p.MessageThread.Message[0];
      return {
        threadId: p.MessageThread.id,
        senderName,
        preview: lastMsg?.content ? lastMsg.content.slice(0, 80) : 'New message',
        time: p.MessageThread.updatedAt,
      };
    });

    res.json({ success: true, data: threads, count: threads.length });
  } catch (error: any) {
    console.error('Error fetching unread messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch unread messages' });
  }
};

// GET /communication/contacts
// Returns users this caller is allowed to message.
// STARTUP → sees ADMIN, SUPER_ADMIN, STAFF, MENTOR
// Everyone else → sees STARTUP users + ADMIN/STAFF/MENTOR (anyone except themselves)
export const getContacts = async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const q = (req.query.q as string || '').toLowerCase();

    let roleFilter: string[];
    if (userRole === 'STARTUP') {
      roleFilter = ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'MENTOR'];
    } else {
      roleFilter = ['ADMIN', 'SUPER_ADMIN', 'STAFF', 'MENTOR', 'STARTUP'];
    }

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        id: { not: userId },
        role: { in: roleFilter },
        ...(q ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]
        } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
      take: 30,
    });

    res.json({ success: true, data: users });
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch contacts' });
  }
};
