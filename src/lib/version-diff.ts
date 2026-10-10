type Task = { name: string; total_hours: number | string; total_cost: number | string };
type Snapshot = { modules: { name: string; tasks: Task[] }[] };
export type TaskChange = { module: string; task: string; beforeHours: number | null; afterHours: number | null; beforeCost: number | null; afterCost: number | null };

// ponytail: match by module/task name and occurrence; use stable task IDs if revisions preserve them.
export function compareVersions(before: Snapshot, after: Snapshot): TaskChange[] {
  const flatten = (snapshot: Snapshot) => {
    const rows = new Map<string, { module: string; task: string; hours: number; cost: number }>();
    const occurrences = new Map<string, number>();
    for (const item of snapshot.modules) for (const task of item.tasks) {
      const label = JSON.stringify([item.name, task.name]);
      const occurrence = occurrences.get(label) ?? 0;
      occurrences.set(label, occurrence + 1);
      rows.set(JSON.stringify([item.name, task.name, occurrence]), {
        module: item.name, task: task.name, hours: Number(task.total_hours), cost: Number(task.total_cost),
      });
    }
    return rows;
  };
  const oldRows = flatten(before);
  const newRows = flatten(after);
  const result: TaskChange[] = [];
  for (const key of new Set([...oldRows.keys(), ...newRows.keys()])) {
    const oldRow = oldRows.get(key);
    const newRow = newRows.get(key);
    if (oldRow?.hours === newRow?.hours && oldRow?.cost === newRow?.cost) continue;
    result.push({
      module: (newRow ?? oldRow)!.module, task: (newRow ?? oldRow)!.task,
      beforeHours: oldRow?.hours ?? null, afterHours: newRow?.hours ?? null,
      beforeCost: oldRow?.cost ?? null, afterCost: newRow?.cost ?? null,
    });
  }
  return result;
}
