// server/src/controllers/auditController.js
import AuditLog from '../models/AuditLog.js';

export const createAuditLog = async (logData) => {
  try {
    const auditLog = new AuditLog(logData);
    await auditLog.save();
    return auditLog;
  } catch (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
};

export default {
  createAuditLog
};