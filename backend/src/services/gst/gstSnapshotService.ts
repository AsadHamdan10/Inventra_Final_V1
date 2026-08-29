import crypto from 'crypto';

export class GstSnapshotService {
  public static generateHash(payload: any): string {
    const jsonString = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  }
}
