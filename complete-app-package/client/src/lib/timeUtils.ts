/**
 * Formats a time string to display in the user's local timezone
 * @param timeStr - ISO datetime string or HH:MM format
 * @returns Formatted time string with timezone
 */
export function formatTime(timeStr: string | null): string {
  if (!timeStr) return 'TBD';
  
  try {
    // If timeStr is an ISO string, parse it and show in local timezone
    if (timeStr.includes('T') || timeStr.includes('Z')) {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });
    }
    
    // If it's just time format like "19:30", assume it's already local
    const [hours, minutes] = timeStr.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    return timeStr;
  }
}

/**
 * Formats a date to display in a user-friendly format
 * @param dateStr - Date string
 * @returns Formatted date string
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}