import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import type { ScheduledTask } from "../types";

export function SchedulerTab() {
  const scheduledTasks = useAppStore((state) => state.scheduledTasks);
  const sendEvent = useAppStore((state) => state.sendEvent);
  
  // Form state for creating new task
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [schedule, setSchedule] = useState("");
  const [notifyBefore, setNotifyBefore] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load tasks on mount
  useEffect(() => {
    sendEvent({ type: "scheduler.tasks.get" });
  }, [sendEvent]);

  const formatNextRun = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = timestamp - now.getTime();
    
    if (diffMs < 0) {
      return "Overdue";
    }
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 60) {
      return `in ${diffMins} min`;
    } else if (diffHours < 24) {
      return `in ${diffHours} hrs`;
    } else if (diffDays < 7) {
      return `in ${diffDays} days`;
    }
    
    return date.toLocaleDateString();
  };

  const handleCreateTask = async () => {
    if (!title.trim() || !schedule.trim()) return;
    
    setIsSubmitting(true);
    try {
      const nextRun = calculateNextRun(schedule);
      if (!nextRun) {
        alert("Invalid schedule format");
        return;
      }

      const isRecurring = schedule.startsWith("every") || schedule.startsWith("daily");
      
      const task: Omit<ScheduledTask, 'createdAt' | 'updatedAt'> = {
        id: crypto.randomUUID(),
        title: title.trim(),
        prompt: prompt.trim() || undefined,
        schedule,
        nextRun,
        isRecurring,
        notifyBefore,
        enabled: true,
      };
      
      sendEvent({ type: "scheduler.task.create", payload: task });
      
      // Reset form
      setTitle("");
      setPrompt("");
      setSchedule("");
      setNotifyBefore(undefined);
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = (taskId: string, enabled: boolean) => {
    sendEvent({
      type: "scheduler.task.update",
      payload: { id: taskId, enabled }
    });
  };

  const handleDeleteTask = (taskId: string) => {
    if (confirm("Delete this scheduled task?")) {
      sendEvent({
        type: "scheduler.task.delete",
        payload: { id: taskId }
      });
    }
  };

  // Parse schedule string and calculate next run time
  const calculateNextRun = (scheduleStr: string): number | null => {
    const now = new Date();
    const schedule = scheduleStr.toLowerCase().trim();

    // "in X minutes/hours/days"
    const inMatch = schedule.match(/^in\s+(\d+)\s*(min(?:ute)?s?|hrs?|hours?|days?)$/i);
    if (inMatch) {
      const value = parseInt(inMatch[1], 10);
      const unit = inMatch[2].toLowerCase();
      
      if (unit.startsWith("min")) {
        return now.getTime() + value * 60 * 1000;
      } else if (unit.startsWith("h")) {
        return now.getTime() + value * 60 * 60 * 1000;
      } else if (unit.startsWith("d")) {
        return now.getTime() + value * 24 * 60 * 60 * 1000;
      }
    }

    // "at HH:MM" (today or tomorrow)
    const atMatch = schedule.match(/^at\s+(\d{1,2}):(\d{2})$/i);
    if (atMatch) {
      const hours = parseInt(atMatch[1], 10);
      const minutes = parseInt(atMatch[2], 10);
      
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);
      
      // If time already passed today, schedule for tomorrow
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      
      return target.getTime();
    }

    // "tomorrow at HH:MM"
    const tomorrowMatch = schedule.match(/^tomorrow\s+at\s+(\d{1,2}):(\d{2})$/i);
    if (tomorrowMatch) {
      const hours = parseInt(tomorrowMatch[1], 10);
      const minutes = parseInt(tomorrowMatch[2], 10);
      
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(hours, minutes, 0, 0);
      
      return target.getTime();
    }

    // "every day at HH:MM" / "daily at HH:MM"
    const dailyMatch = schedule.match(/^(?:every\s+day|daily)\s+at\s+(\d{1,2}):(\d{2})$/i);
    if (dailyMatch) {
      const hours = parseInt(dailyMatch[1], 10);
      const minutes = parseInt(dailyMatch[2], 10);
      
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);
      
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
      
      return target.getTime();
    }

    // "every X minutes/hours"
    const everyMatch = schedule.match(/^every\s+(\d+)\s*(min(?:ute)?s?|hrs?|hours?)$/i);
    if (everyMatch) {
      const value = parseInt(everyMatch[1], 10);
      const unit = everyMatch[2].toLowerCase();
      
      if (unit.startsWith("min")) {
        return now.getTime() + value * 60 * 1000;
      } else if (unit.startsWith("h")) {
        return now.getTime() + value * 60 * 60 * 1000;
      }
    }

    return null;
  };

  const scheduleExamples = [
    "in 30 minutes",
    "in 2 hours",
    "at 14:00",
    "tomorrow at 09:00",
    "daily at 10:00",
    "every 30 minutes",
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">Scheduled Tasks</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent/90 transition-colors"
        >
          {showForm ? "Cancel" : "+ New Task"}
        </button>
      </div>

      {showForm && (
        <div className="p-4 bg-surface-secondary rounded-lg border border-ink-900/10 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Remind me to..."
              className="w-full px-3 py-2 bg-surface border border-ink-900/20 rounded-md focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Schedule *</label>
            <input
              type="text"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g., in 30 minutes, at 14:00, daily at 10:00"
              className="w-full px-3 py-2 bg-surface border border-ink-900/20 rounded-md focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {scheduleExamples.map((example) => (
                <button
                  key={example}
                  onClick={() => setSchedule(example)}
                  className="text-xs px-2 py-0.5 bg-ink-900/5 rounded hover:bg-ink-900/10 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prompt (optional)</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="What should the agent do when this task runs?"
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-ink-900/20 rounded-md focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notify before (minutes)</label>
            <input
              type="number"
              value={notifyBefore ?? ""}
              onChange={(e) => setNotifyBefore(e.target.value ? parseInt(e.target.value, 10) : undefined)}
              placeholder="e.g., 5"
              min={1}
              className="w-32 px-3 py-2 bg-surface border border-ink-900/20 rounded-md focus:ring-2 focus:ring-accent/50 focus:border-accent text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-muted hover:text-ink-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateTask}
              disabled={!title.trim() || !schedule.trim() || isSubmitting}
              className="px-4 py-1.5 text-sm bg-accent text-white rounded-md hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Create Task"}
            </button>
          </div>
        </div>
      )}

      {scheduledTasks.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <p>No scheduled tasks yet.</p>
          <p className="text-sm mt-1">Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {scheduledTasks.map((task) => (
            <div
              key={task.id}
              className={`p-3 bg-surface-secondary rounded-lg border ${
                task.enabled ? "border-ink-900/10" : "border-ink-900/5 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${task.enabled ? "" : "line-through"}`}>
                      {task.title}
                    </span>
                    {task.isRecurring && (
                      <span className="text-xs px-1.5 py-0.5 bg-accent/10 text-accent rounded">
                        recurring
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    <span>{task.schedule}</span>
                    <span className="mx-1">•</span>
                    <span>{formatNextRun(task.nextRun)}</span>
                  </div>
                  {task.prompt && (
                    <div className="text-xs text-muted mt-1 truncate" title={task.prompt}>
                      Prompt: {task.prompt.substring(0, 50)}{task.prompt.length > 50 ? "..." : ""}
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleTask(task.id, !task.enabled)}
                    className={`w-8 h-5 rounded-full transition-colors ${
                      task.enabled ? "bg-accent" : "bg-ink-900/20"
                    }`}
                  >
                    <span
                      className={`block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        task.enabled ? "translate-x-3.5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1 text-muted hover:text-red-500 transition-colors"
                    title="Delete task"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-xs text-muted mt-4 p-3 bg-ink-900/5 rounded">
        <strong>Note:</strong> Scheduled tasks will run when the application is open. 
        If you need to run tasks while the app is closed, consider using system cron/Task Scheduler.
      </div>
    </div>
  );
}
