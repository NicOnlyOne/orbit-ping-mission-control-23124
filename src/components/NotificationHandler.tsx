import { useEffect } from 'react';
import { onForegroundMessage } from '../firebase';

export const NotificationHandler = () => {
  useEffect(() => {
    const handleMessage = (payload: any) => {
      const { title, body } = payload.notification;
      new Notification(title, { body });
    };

    onForegroundMessage(handleMessage);
  }, []);

  return null;
};
