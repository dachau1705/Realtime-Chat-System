import * as notificationRepo from '../repositories/notification.repository';

export async function getNotifications(userId: string) {
  return await notificationRepo.getUserNotifications(userId);
}

export async function markAsRead(userId: string) {
  await notificationRepo.markAllNotificationsRead(userId);
  return { message: 'Notifications marked as read successfully' };
}
