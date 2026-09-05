// src/lib/notifications.js

// 1. Request permission from the user
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.log("This browser does not support desktop notifications");
    return false;
  }
  
  if (Notification.permission !== "granted" && Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  
  return Notification.permission === "granted";
};

// 2. Send the actual OS notification
export const sendNotification = (title, body) => {
  if (Notification.permission === "granted") {
    // We use a 'tag' to prevent spamming multiple alerts at once
    new Notification(title, {
      body,
      icon: "/favicon.ico", // Replace with your actual logo path
      badge: "/favicon.ico",
      tag: "gilmore-study-reminder", 
      requireInteraction: false, // Auto-dismisses after a few seconds
    });
  }
};

// 3. Thematic Messages (Dark Academia / Gilmore Girls style)
export const MESSAGES = {
  noTasks: {
    title: "☕ A Blank Page?",
    body: "Lorelai says: 'Write down your plans for the day, even if it's just drinking coffee.' Open the app to plan your day!"
  },
  bookStall: {
    title: "📚 Your Book is Gathering Dust",
    body: "The Dean expects you to turn at least one page today. Don't let your library go to waste!"
  },
  goalStall: {
    title: "🎯 Goals are Waiting",
    body: "Don't let your dreams become 'someday'. You haven't made progress on your goals in 2 days. Check in!"
  },
  streak: {
    title: " Keep the Flame Alive",
    body: "Your focus streak is waiting for you. A true scholar never misses a day of deep work."
  }
};